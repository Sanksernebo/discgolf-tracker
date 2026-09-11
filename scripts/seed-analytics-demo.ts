/**
 * Analytics demo seeder.
 *
 * Fills the database with a plausible year-plus of CheckIn rows so the
 * admin analytics dashboard has something to show on a fresh demo server.
 *
 * How to run:
 *   npm run seed:analytics-demo              # default: ~400 days back
 *   DEMO_DAYS=200 npm run seed:analytics-demo
 *   RESET_DEMO=false npm run seed:analytics-demo   # keep old demo rows
 *
 * All rows this script creates have deviceIds prefixed with `demo-` so a
 * repeat run can wipe just its own data without touching real check-ins.
 * A handful of open issue reports are seeded too so the Issues tab isn't
 * empty during a walk-through.
 *
 * Safety: refuses to run against the production DATABASE_URL unless
 * FORCE_DEMO_SEED=1 is set — demo data on prod would be embarrassing.
 */

import { PrismaClient, type Course } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_DEVICE_PREFIX = "demo-";
const DEMO_DAYS = Number(process.env.DEMO_DAYS ?? 400);
const RESET = (process.env.RESET_DEMO ?? "true").toLowerCase() !== "false";

/* -------------------------------------------------------------------------- */
/*                          Deterministic randomness                          */
/* -------------------------------------------------------------------------- */

/**
 * Seeded PRNG (mulberry32). Deterministic runs make the analytics screenshots
 * reproducible for a sales demo — the "peak hour" doesn't drift each rebuild.
 */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(0xdeadbeef);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/* -------------------------------------------------------------------------- */
/*                             Realism heuristics                             */
/* -------------------------------------------------------------------------- */

/** Rough season multiplier — Estonian disc golf peaks May–August. */
function seasonMultiplier(date: Date): number {
  // sin curve peaking in July, low in January.
  const dayOfYear =
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      Date.UTC(date.getUTCFullYear(), 0, 0)) /
    86400000;
  const phase = ((dayOfYear - 172) / 365) * 2 * Math.PI; // 172 ≈ Jun 21
  // 0.15 in deep winter, 1.15 in July
  return 0.65 + 0.5 * Math.cos(phase);
}

/** Weekend boost. */
function weekdayMultiplier(date: Date): number {
  const w = date.getUTCDay(); // 0 = Sun, 6 = Sat
  if (w === 0 || w === 6) return 2.2;
  if (w === 5) return 1.6; // Friday afternoon uptick
  return 1.0;
}

/** Small linear growth trend so period-over-period deltas trend up. */
function growthMultiplier(daysAgo: number): number {
  // ~30% higher today than a year ago.
  return 1 + Math.max(0, (365 - daysAgo) / 365) * 0.3;
}

/**
 * Time-of-day probability curve (returns 0..1 for a given hour). Peaks
 * mid-morning and again after work; nights are near-dead.
 */
function hourWeight(hour: number): number {
  const bumps = [
    { center: 11, spread: 2.5, height: 1.0 }, // mid-morning
    { center: 14, spread: 3, height: 0.7 }, // afternoon
    { center: 18, spread: 2, height: 1.1 }, // after work
  ];
  let w = 0.02; // small floor so an odd 23:00 check-in can still happen
  for (const b of bumps) {
    const d = hour - b.center;
    w += b.height * Math.exp(-(d * d) / (2 * b.spread * b.spread));
  }
  return w;
}

const HOUR_WEIGHTS = Array.from({ length: 24 }, (_, h) => hourWeight(h));
const HOUR_WEIGHT_SUM = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);

function sampleHour(): number {
  const target = rng() * HOUR_WEIGHT_SUM;
  let acc = 0;
  for (let h = 0; h < 24; h += 1) {
    acc += HOUR_WEIGHTS[h];
    if (target <= acc) return h;
  }
  return 23;
}

/**
 * Sample party size — skewed toward small groups but the tail matters
 * because it drives the "average party size" card upward.
 */
function sampleParty(): number {
  const r = rng();
  if (r < 0.55) return 1;
  if (r < 0.85) return 2;
  if (r < 0.95) return 3;
  if (r < 0.99) return 4;
  return 5;
}

/** Session length in minutes: 40–140 with a long tail. */
function sampleDurationMinutes(): number {
  const base = 40 + Math.floor(rng() * 80);
  return rng() < 0.1 ? base + 30 + Math.floor(rng() * 30) : base;
}

/* -------------------------------------------------------------------------- */
/*                               Device pool                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build a fixed pool of demo devices per course. Sampling from a bounded
 * pool means the same device appears in multiple check-ins, so the "unique
 * visitors" and "% returning" cards show non-trivial values instead of the
 * pathological 100% new / 0% returning shape you get from all-random ids.
 */
function makeDevicePool(courseId: string, size: number): string[] {
  return Array.from(
    { length: size },
    (_, i) => `${DEMO_DEVICE_PREFIX}${courseId}-${i.toString(36)}`,
  );
}

function sampleDevice(pool: string[]): string {
  // Zipf-ish bias — a few "regulars" show up much more than casual visitors.
  const skewed = Math.floor(pool.length * Math.pow(rng(), 2));
  return pool[Math.min(skewed, pool.length - 1)];
}

/* -------------------------------------------------------------------------- */
/*                                Main routine                                */
/* -------------------------------------------------------------------------- */

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const looksLikeProd =
    /amazonaws\.com|planetscale|neon\.tech|prisma\.io|rds\.amazonaws/.test(url);
  if (looksLikeProd && process.env.FORCE_DEMO_SEED !== "1") {
    console.error(
      "Refusing to seed demo data against what looks like a production database.\n" +
        `DATABASE_URL: ${url.replace(/:[^@/]+@/, ":***@")}\n` +
        "Set FORCE_DEMO_SEED=1 to override.",
    );
    process.exit(1);
  }

  const courses = await prisma.course.findMany({
    orderBy: { nameEt: "asc" },
  });
  if (courses.length === 0) {
    console.error(
      "No courses in the database — run `npm run seed` first to create courses,\n" +
        "then re-run this script to fill them with demo check-ins.",
    );
    process.exit(1);
  }

  console.log(
    `Seeding ~${DEMO_DAYS} days of demo analytics across ${courses.length} course(s).`,
  );

  if (RESET) {
    const gone = await prisma.checkIn.deleteMany({
      where: { deviceId: { startsWith: DEMO_DEVICE_PREFIX } },
    });
    const goneIssues = await prisma.issueReport.deleteMany({
      where: { deviceId: { startsWith: DEMO_DEVICE_PREFIX } },
    });
    console.log(
      `Cleared ${gone.count} previous demo check-in(s) and ${goneIssues.count} demo issue(s).`,
    );
  }

  const now = new Date();
  let totalRows = 0;

  for (let i = 0; i < courses.length; i += 1) {
    const course = courses[i];
    // Give each course its own baseline popularity so the per-course
    // breakdown table shows a meaningful ranking. Larger courses (18 holes)
    // draw more players than 9-hole ones.
    const holeCount = await prisma.hole.count({
      where: { courseId: course.id },
    });
    const sizeFactor = holeCount >= 18 ? 1.3 : holeCount >= 12 ? 1.0 : 0.7;
    const popularity = (0.6 + rng() * 0.9) * sizeFactor;
    // Pool size scales with popularity — a busier course has more regulars.
    const devices = makeDevicePool(
      course.id,
      Math.max(20, Math.round(60 * popularity)),
    );

    const rows = generateCourseCheckins(course, devices, popularity, now);
    if (rows.length > 0) {
      await prisma.checkIn.createMany({ data: rows });
    }
    totalRows += rows.length;
    console.log(
      `  ${course.nameEt.padEnd(36)} → ${rows.length.toString().padStart(5)} rows` +
        ` (popularity ${popularity.toFixed(2)}, ${devices.length} devices)`,
    );
  }

  // A handful of currently-active check-ins so the "On course now" card
  // isn't zero during the demo. Spread across a couple of random courses.
  await seedActiveNow(courses, now);

  // Some open + closed issue reports so the Issues tab has content.
  await seedIssues(courses);

  console.log(
    `\nDone: created ${totalRows} check-in(s) tagged '${DEMO_DEVICE_PREFIX}*'.`,
  );
}

function generateCourseCheckins(
  course: Course,
  devices: string[],
  popularity: number,
  now: Date,
): Array<{
  courseId: string;
  deviceId: string;
  partySize: number;
  startedAt: Date;
  lastPingAt: Date;
  endedAt: Date | null;
}> {
  const rows: Array<{
    courseId: string;
    deviceId: string;
    partySize: number;
    startedAt: Date;
    lastPingAt: Date;
    endedAt: Date | null;
  }> = [];

  for (let daysAgo = DEMO_DAYS; daysAgo >= 1; daysAgo -= 1) {
    const day = new Date(now.getTime() - daysAgo * 86400000);
    day.setUTCHours(0, 0, 0, 0);

    const baseline = 3.5 * popularity;
    const expected =
      baseline *
      seasonMultiplier(day) *
      weekdayMultiplier(day) *
      growthMultiplier(daysAgo);
    // Add ±20% noise on top of the model so the daily line isn't perfectly
    // smooth — real graphs never are.
    const count = Math.max(
      0,
      Math.round(expected * (0.8 + rng() * 0.4)),
    );

    for (let j = 0; j < count; j += 1) {
      const hour = sampleHour();
      const minute = Math.floor(rng() * 60);
      const startedAt = new Date(day);
      startedAt.setUTCHours(hour, minute, Math.floor(rng() * 60), 0);
      const durationMin = sampleDurationMinutes();
      const endedAt = new Date(startedAt.getTime() + durationMin * 60000);
      rows.push({
        courseId: course.id,
        deviceId: sampleDevice(devices),
        partySize: sampleParty(),
        startedAt,
        // A small share of sessions look "abandoned" (endedAt null but the
        // last ping recent enough that traffic.ts considers them expired).
        lastPingAt:
          rng() < 0.9
            ? endedAt
            : new Date(startedAt.getTime() + (durationMin / 2) * 60000),
        endedAt: rng() < 0.9 ? endedAt : null,
      });
    }
  }

  return rows;
}

async function seedActiveNow(courses: Course[], now: Date) {
  // Pick 2–4 courses at random and add one live session each. Startedat
  // within the last hour keeps them inside the ACTIVE_WINDOW_MINUTES=180
  // window used by traffic.ts.
  const picks = new Set<string>();
  const target = 2 + Math.floor(rng() * 3);
  while (picks.size < Math.min(target, courses.length)) {
    picks.add(pick(courses).id);
  }
  const rows = Array.from(picks).map((courseId, idx) => {
    const startedAt = new Date(now.getTime() - (5 + idx * 20) * 60000);
    return {
      courseId,
      deviceId: `${DEMO_DEVICE_PREFIX}live-${idx}`,
      partySize: 1 + Math.floor(rng() * 3),
      startedAt,
      lastPingAt: now,
      endedAt: null,
    };
  });
  if (rows.length > 0) {
    await prisma.checkIn.createMany({ data: rows });
    console.log(`  + ${rows.length} live check-in(s) for "on course now".`);
  }
}

async function seedIssues(courses: Course[]) {
  const templates: Array<{
    category: "course" | "app" | "other";
    message: string;
  }> = [
    { category: "course", message: "Broken chains on hole 5, missing 3 links." },
    { category: "course", message: "Trash bin near tee 12 is overflowing." },
    { category: "course", message: "Signage between hole 8 and 9 is confusing." },
    { category: "app", message: "Push notification arrived twice in a row." },
    { category: "other", message: "Would be great to have a scoring feature." },
    { category: "course", message: "Water pooling on fairway of hole 3 after rain." },
  ];
  const rows = templates.map((t, i) => ({
    courseId: pick(courses).id,
    category: t.category,
    message: t.message,
    deviceId: `${DEMO_DEVICE_PREFIX}issue-${i}`,
    status: i < 4 ? "open" : "closed",
  }));
  await prisma.issueReport.createMany({ data: rows });
  console.log(`  + ${rows.length} demo issue report(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
