import { prisma } from "./prisma";
import { activeSinceThreshold } from "./traffic";

/**
 * Analytics for the admin panel — derived entirely from CheckIn rows.
 *
 * We deliberately keep aggregation in JS (rather than raw SQL) so the module
 * stays portable across Prisma providers and easy to test. Admin panel volumes
 * are modest: even a busy course produces on the order of thousands of check-
 * ins per year, well within what a single SELECT can carry.
 *
 * Date bucketing uses Europe/Tallinn — this is an Estonian app and admins
 * want "today" to mean the local day, not UTC midnight.
 */

const TZ = "Europe/Tallinn";

export type RangePreset = "day" | "week" | "month" | "year" | "all";

export type AnalyticsSummary = {
  /** Number of check-in rows in the window. */
  checkIns: number;
  /** Distinct deviceIds in the window (a person who came twice counts once). */
  uniqueVisitors: number;
  /** Sum of partySize (total humans, groups counted per-person). */
  players: number;
  /** Mean partySize per check-in (rounded to 1 dp). */
  avgPartySize: number;
  /** Mean session length in minutes, using endedAt || lastPingAt. */
  avgDurationMinutes: number;
  /**
   * Share of unique devices that appear on ≥2 check-in rows in the window.
   * A rough "loyalty" indicator — 0..1.
   */
  returningRate: number;
  /** People currently on course (uses the same active-window rules as the map). */
  activeNow: number;
};

export type DailyBucket = {
  /** YYYY-MM-DD in Europe/Tallinn. */
  date: string;
  checkIns: number;
  uniqueVisitors: number;
  players: number;
};

export type HourBucket = { hour: number; checkIns: number; players: number };
export type WeekdayBucket = {
  /** 0 = Monday … 6 = Sunday (ISO-ish; matches how humans read a week). */
  weekday: number;
  checkIns: number;
  players: number;
};

export type CourseBreakdownRow = {
  courseId: string;
  nameEt: string;
  nameEn: string;
  checkIns: number;
  players: number;
  uniqueVisitors: number;
};

/**
 * Utilization cell for the weekday × hour heatmap. `weekday` follows the
 * same Monday-first indexing as WeekdayBucket; `hour` is 0..23 in local
 * Europe/Tallinn time.
 */
export type HeatCell = {
  weekday: number;
  hour: number;
  checkIns: number;
  players: number;
};

export type AnalyticsResult = {
  from: string;
  to: string;
  summary: AnalyticsSummary;
  /**
   * Summary for the same-length window immediately preceding [from, to].
   * `null` when the caller asked to skip the comparison, letting the UI hide
   * the delta chips instead of showing "-100%" against an empty history.
   */
  previousSummary: AnalyticsSummary | null;
  daily: DailyBucket[];
  hourly: HourBucket[];
  weekday: WeekdayBucket[];
  /** Length always 7×24 = 168; ordered by weekday then hour. */
  heatmap: HeatCell[];
  courses: CourseBreakdownRow[];
};

/* -------------------------------------------------------------------------- */
/*                         Europe/Tallinn date helpers                        */
/* -------------------------------------------------------------------------- */

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hour12: false,
});
// Long weekday names so we can map to a stable index regardless of locale.
const weekdayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  weekday: "long",
});
const WEEKDAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

/** "YYYY-MM-DD" in Tallinn local time. */
export function localDay(d: Date): string {
  return dayFmt.format(d);
}
function localHour(d: Date): number {
  return Number(hourFmt.format(d));
}
function localWeekday(d: Date): number {
  return WEEKDAY_INDEX[weekdayFmt.format(d)] ?? 0;
}

/** Iterate YYYY-MM-DD dates from `from` (inclusive) to `to` (inclusive). */
function* eachLocalDay(from: Date, to: Date): Generator<string> {
  // Walk UTC day-by-day; convert each to a Tallinn day string. This is robust
  // across DST because the emitted strings come from Intl, not from us doing
  // hour math ourselves.
  const cursor = new Date(from.getTime());
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to.getTime());
  end.setUTCHours(23, 59, 59, 999);
  const seen = new Set<string>();
  while (cursor <= end) {
    const key = localDay(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      yield key;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

/* -------------------------------------------------------------------------- */
/*                             Range preset → dates                           */
/* -------------------------------------------------------------------------- */

export function resolveRange(
  preset: RangePreset,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = now;
  const from = new Date(now.getTime());
  switch (preset) {
    case "day":
      from.setUTCDate(from.getUTCDate() - 1);
      break;
    case "week":
      from.setUTCDate(from.getUTCDate() - 7);
      break;
    case "month":
      from.setUTCDate(from.getUTCDate() - 30);
      break;
    case "year":
      from.setUTCDate(from.getUTCDate() - 365);
      break;
    case "all":
      // Something long enough to include the app's entire history.
      from.setUTCFullYear(2000, 0, 1);
      from.setUTCHours(0, 0, 0, 0);
      break;
  }
  return { from, to };
}

/* -------------------------------------------------------------------------- */
/*                                 Main entry                                 */
/* -------------------------------------------------------------------------- */

export type AnalyticsInput = {
  /** Course scope; `null` means all courses (superuser); `[]` means none. */
  courseIds: string[] | null;
  from: Date;
  to: Date;
  /** Optional single-course filter that intersects with `courseIds`. */
  focusCourseId?: string | null;
  /**
   * When true (default), also fetch the same-length window immediately
   * preceding [from, to] so the UI can render period-over-period deltas.
   */
  compareToPrevious?: boolean;
};

/** [from, to] range of the same length that ends where the current one starts. */
export function previousRange(
  from: Date,
  to: Date,
): { from: Date; to: Date } {
  const span = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - span),
    to: new Date(from.getTime()),
  };
}

export async function getAnalytics(
  input: AnalyticsInput,
): Promise<AnalyticsResult> {
  const { from, to, focusCourseId } = input;
  const compareToPrevious = input.compareToPrevious ?? true;

  // Resolve final course scope: intersect the admin's editable set with any
  // course selected in the UI. `null` means "no filter" (superuser, all).
  let scope: string[] | null = input.courseIds;
  if (focusCourseId) {
    if (scope === null) scope = [focusCourseId];
    else scope = scope.filter((id) => id === focusCourseId);
  }

  // A courseAdmin with no assignments (or a focus filter that intersects to
  // nothing) sees an empty analytics view rather than everyone's data.
  const emptyScope = scope !== null && scope.length === 0;
  const scopeFilter = scope === null ? {} : { courseId: { in: scope } };

  const prev = compareToPrevious ? previousRange(from, to) : null;

  const [rows, prevRows, coursesMeta, activeCount] = await Promise.all([
    emptyScope
      ? Promise.resolve([])
      : prisma.checkIn.findMany({
          where: { startedAt: { gte: from, lte: to }, ...scopeFilter },
          select: {
            deviceId: true,
            courseId: true,
            partySize: true,
            startedAt: true,
            endedAt: true,
            lastPingAt: true,
          },
        }),
    prev && !emptyScope
      ? prisma.checkIn.findMany({
          where: {
            startedAt: { gte: prev.from, lt: prev.to },
            ...scopeFilter,
          },
          select: {
            deviceId: true,
            courseId: true,
            partySize: true,
            startedAt: true,
            endedAt: true,
            lastPingAt: true,
          },
        })
      : Promise.resolve([]),
    prisma.course.findMany({
      where: scope === null ? {} : { id: { in: scope ?? [] } },
      select: { id: true, nameEt: true, nameEn: true },
      orderBy: { nameEt: "asc" },
    }),
    computeActiveNow(scope),
  ]);

  const current = buildAnalytics(rows, coursesMeta, from, to, activeCount);
  if (!prev) {
    return { ...current, previousSummary: null };
  }
  const previous = buildAnalytics(prevRows, coursesMeta, prev.from, prev.to, 0);
  return { ...current, previousSummary: previous.summary };
}

async function computeActiveNow(scope: string[] | null): Promise<number> {
  if (scope !== null && scope.length === 0) return 0;
  const since = activeSinceThreshold();
  const agg = await prisma.checkIn.aggregate({
    where: {
      endedAt: null,
      lastPingAt: { gt: since },
      startedAt: { gt: since },
      ...(scope === null ? {} : { courseId: { in: scope } }),
    },
    _sum: { partySize: true },
  });
  return agg._sum.partySize ?? 0;
}

/* -------------------------------------------------------------------------- */
/*                          Pure aggregation (testable)                       */
/* -------------------------------------------------------------------------- */

type CheckInRow = {
  deviceId: string;
  courseId: string;
  partySize: number;
  startedAt: Date;
  endedAt: Date | null;
  lastPingAt: Date;
};

export function buildAnalytics(
  rows: CheckInRow[],
  coursesMeta: { id: string; nameEt: string; nameEn: string }[],
  from: Date,
  to: Date,
  activeNow: number,
): AnalyticsResult {
  // Summary counters.
  let players = 0;
  let durationSum = 0;
  let durationCount = 0;
  const uniqueDevices = new Set<string>();
  const deviceCounts = new Map<string, number>();

  const dayMap = new Map<
    string,
    { checkIns: number; players: number; devices: Set<string> }
  >();
  const hourMap = new Map<number, { checkIns: number; players: number }>();
  const weekMap = new Map<number, { checkIns: number; players: number }>();
  // Weekday × hour heatmap indexed as w * 24 + h.
  const heatMap = new Map<number, { checkIns: number; players: number }>();
  const courseMap = new Map<
    string,
    { checkIns: number; players: number; devices: Set<string> }
  >();

  // Pre-fill day buckets so the chart's x-axis is continuous even on quiet
  // days. Hour/weekday buckets get filled below to a fixed size.
  for (const day of eachLocalDay(from, to)) {
    dayMap.set(day, { checkIns: 0, players: 0, devices: new Set() });
  }
  for (let h = 0; h < 24; h += 1) {
    hourMap.set(h, { checkIns: 0, players: 0 });
  }
  for (let w = 0; w < 7; w += 1) {
    weekMap.set(w, { checkIns: 0, players: 0 });
    for (let h = 0; h < 24; h += 1) {
      heatMap.set(w * 24 + h, { checkIns: 0, players: 0 });
    }
  }
  for (const c of coursesMeta) {
    courseMap.set(c.id, { checkIns: 0, players: 0, devices: new Set() });
  }

  for (const r of rows) {
    players += r.partySize;
    uniqueDevices.add(r.deviceId);
    deviceCounts.set(r.deviceId, (deviceCounts.get(r.deviceId) ?? 0) + 1);

    const end = r.endedAt ?? r.lastPingAt;
    // Clamp negatives — clock skew could theoretically push a ping earlier
    // than startedAt during a bad reconnect; treat those as 0-length rather
    // than dragging the mean down.
    const mins = Math.max(0, (end.getTime() - r.startedAt.getTime()) / 60000);
    durationSum += mins;
    durationCount += 1;

    const dayKey = localDay(r.startedAt);
    const dayBucket = dayMap.get(dayKey);
    if (dayBucket) {
      dayBucket.checkIns += 1;
      dayBucket.players += r.partySize;
      dayBucket.devices.add(r.deviceId);
    }

    const hour = localHour(r.startedAt);
    const weekday = localWeekday(r.startedAt);

    const hourBucket = hourMap.get(hour)!;
    hourBucket.checkIns += 1;
    hourBucket.players += r.partySize;

    const weekBucket = weekMap.get(weekday)!;
    weekBucket.checkIns += 1;
    weekBucket.players += r.partySize;

    const heatBucket = heatMap.get(weekday * 24 + hour)!;
    heatBucket.checkIns += 1;
    heatBucket.players += r.partySize;

    const courseBucket = courseMap.get(r.courseId);
    if (courseBucket) {
      courseBucket.checkIns += 1;
      courseBucket.players += r.partySize;
      courseBucket.devices.add(r.deviceId);
    }
  }

  let returning = 0;
  for (const count of deviceCounts.values()) {
    if (count >= 2) returning += 1;
  }
  const returningRate =
    uniqueDevices.size === 0 ? 0 : returning / uniqueDevices.size;

  const summary: AnalyticsSummary = {
    checkIns: rows.length,
    uniqueVisitors: uniqueDevices.size,
    players,
    avgPartySize:
      rows.length === 0 ? 0 : Math.round((players / rows.length) * 10) / 10,
    avgDurationMinutes:
      durationCount === 0 ? 0 : Math.round(durationSum / durationCount),
    returningRate: Math.round(returningRate * 1000) / 1000,
    activeNow,
  };

  const daily: DailyBucket[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, b]) => ({
      date,
      checkIns: b.checkIns,
      players: b.players,
      uniqueVisitors: b.devices.size,
    }));

  const hourly: HourBucket[] = Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, b]) => ({ hour, ...b }));

  const weekday: WeekdayBucket[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekday, b]) => ({ weekday, ...b }));

  const heatmap: HeatCell[] = [];
  for (let w = 0; w < 7; w += 1) {
    for (let h = 0; h < 24; h += 1) {
      const cell = heatMap.get(w * 24 + h)!;
      heatmap.push({ weekday: w, hour: h, ...cell });
    }
  }

  const courses: CourseBreakdownRow[] = coursesMeta.map((c) => {
    const b = courseMap.get(c.id)!;
    return {
      courseId: c.id,
      nameEt: c.nameEt,
      nameEn: c.nameEn,
      checkIns: b.checkIns,
      players: b.players,
      uniqueVisitors: b.devices.size,
    };
  });
  // Busiest first — helpful when a superuser has many courses.
  courses.sort((a, b) => b.players - a.players);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    summary,
    // getAnalytics fills this in; buildAnalytics on its own returns null so
    // the type is complete for pure callers (tests) that don't need a delta.
    previousSummary: null,
    daily,
    hourly,
    weekday,
    heatmap,
    courses,
  };
}
