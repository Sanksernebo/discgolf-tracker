import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCookieStore, jsonRequest, seedCourse } from "../helpers";
import { prisma } from "@/lib/prisma";
import { hashPassword, ROLE_COURSE_ADMIN } from "@/lib/admin";
import { buildAnalytics, localDay, previousRange } from "@/lib/analytics";

const cookieStore = { current: makeCookieStore() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore.current,
}));

beforeEach(() => {
  cookieStore.current = makeCookieStore();
});

const SUPERUSER_EMAIL = "admin@local";
const SUPERUSER_PW = "test-secret";

async function loginAsSuperuser() {
  const { POST } = await import("@/app/api/admin/login/route");
  const res = await POST(
    jsonRequest("http://x/api/admin/login", {
      email: SUPERUSER_EMAIL,
      password: SUPERUSER_PW,
    }),
  );
  if (res.status !== 200) throw new Error("superuser login failed");
}

async function createCourseAdmin(
  email: string,
  password: string,
  courseIds: string[] = [],
) {
  return prisma.admin.create({
    data: {
      email,
      passwordHash: hashPassword(password),
      role: ROLE_COURSE_ADMIN,
      courses: { create: courseIds.map((c) => ({ courseId: c })) },
    },
  });
}

async function loginAs(email: string, password: string) {
  const { POST } = await import("@/app/api/admin/login/route");
  const res = await POST(
    jsonRequest("http://x/api/admin/login", { email, password }),
  );
  if (res.status !== 200) throw new Error(`login failed for ${email}`);
}

/* -------------------------------------------------------------------------- */
/*                             Pure aggregation                               */
/* -------------------------------------------------------------------------- */

describe("buildAnalytics", () => {
  it("returns all-zeros for no rows", () => {
    const to = new Date("2026-09-11T12:00:00Z");
    const from = new Date("2026-09-04T12:00:00Z");
    const out = buildAnalytics([], [], from, to, 0);
    expect(out.summary.checkIns).toBe(0);
    expect(out.summary.players).toBe(0);
    expect(out.summary.uniqueVisitors).toBe(0);
    expect(out.summary.avgPartySize).toBe(0);
    expect(out.summary.returningRate).toBe(0);
    // Daily bucket count should span the range inclusively (8 days).
    expect(out.daily.length).toBeGreaterThanOrEqual(7);
    expect(out.hourly).toHaveLength(24);
    expect(out.weekday).toHaveLength(7);
  });

  it("sums party size into players and counts unique devices", () => {
    const from = new Date("2026-09-01T00:00:00Z");
    const to = new Date("2026-09-10T00:00:00Z");
    const started = new Date("2026-09-05T10:00:00Z");
    const out = buildAnalytics(
      [
        {
          deviceId: "d1",
          courseId: "c1",
          partySize: 3,
          startedAt: started,
          endedAt: new Date(started.getTime() + 60 * 60 * 1000),
          lastPingAt: started,
        },
        {
          deviceId: "d1",
          courseId: "c1",
          partySize: 1,
          startedAt: new Date("2026-09-06T14:00:00Z"),
          endedAt: null,
          lastPingAt: new Date("2026-09-06T14:30:00Z"),
        },
        {
          deviceId: "d2",
          courseId: "c1",
          partySize: 2,
          startedAt: new Date("2026-09-06T16:00:00Z"),
          endedAt: new Date("2026-09-06T17:00:00Z"),
          lastPingAt: new Date("2026-09-06T17:00:00Z"),
        },
      ],
      [{ id: "c1", nameEt: "R", nameEn: "R" }],
      from,
      to,
      5,
    );
    expect(out.summary.checkIns).toBe(3);
    expect(out.summary.players).toBe(6);
    expect(out.summary.uniqueVisitors).toBe(2);
    expect(out.summary.avgPartySize).toBe(2);
    // Two check-ins are 60 min, one is 30 min → 50.
    expect(out.summary.avgDurationMinutes).toBe(50);
    // d1 has 2 rows, d2 has 1 → 50% returning.
    expect(out.summary.returningRate).toBe(0.5);
    expect(out.summary.activeNow).toBe(5);
    expect(out.courses[0].courseId).toBe("c1");
    expect(out.courses[0].players).toBe(6);
    expect(out.courses[0].uniqueVisitors).toBe(2);
  });

  it("fills a 7×24 heatmap with the same weekday × hour totals", () => {
    // Same started/from/to as the previous test uses for hour+weekday, plus
    // a second row on the same slot to prove counts sum.
    const from = new Date("2026-09-01T00:00:00Z");
    const to = new Date("2026-09-14T00:00:00Z");
    const started = new Date("2026-09-07T10:00:00Z"); // Mon 13:00 Tallinn
    const out = buildAnalytics(
      [
        {
          deviceId: "d1",
          courseId: "c1",
          partySize: 2,
          startedAt: started,
          endedAt: null,
          lastPingAt: started,
        },
        {
          deviceId: "d2",
          courseId: "c1",
          partySize: 1,
          startedAt: started,
          endedAt: null,
          lastPingAt: started,
        },
      ],
      [{ id: "c1", nameEt: "R", nameEn: "R" }],
      from,
      to,
      0,
    );
    expect(out.heatmap).toHaveLength(7 * 24);
    const cell = out.heatmap.find((c) => c.weekday === 0 && c.hour === 13);
    expect(cell?.checkIns).toBe(2);
    expect(cell?.players).toBe(3);
    // Every other cell stays zero.
    const nonEmpty = out.heatmap.filter((c) => c.checkIns > 0);
    expect(nonEmpty).toHaveLength(1);
  });

  it("previousRange returns the same-length window ending where the current one starts", () => {
    const from = new Date("2026-09-08T00:00:00Z");
    const to = new Date("2026-09-15T00:00:00Z");
    const prev = previousRange(from, to);
    expect(prev.to.toISOString()).toBe(from.toISOString());
    expect(prev.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("bins into Tallinn-local hour and weekday", () => {
    // 2026-09-07 is a Monday. 10:00 UTC == 13:00 in Tallinn (EEST, UTC+3).
    const started = new Date("2026-09-07T10:00:00Z");
    const from = new Date("2026-09-01T00:00:00Z");
    const to = new Date("2026-09-14T00:00:00Z");
    const out = buildAnalytics(
      [
        {
          deviceId: "d1",
          courseId: "c1",
          partySize: 1,
          startedAt: started,
          endedAt: null,
          lastPingAt: started,
        },
      ],
      [{ id: "c1", nameEt: "R", nameEn: "R" }],
      from,
      to,
      0,
    );
    const hour = out.hourly.find((h) => h.checkIns > 0);
    expect(hour?.hour).toBe(13);
    // Monday should be weekday index 0 in our Monday-first scheme.
    const weekday = out.weekday.find((w) => w.checkIns > 0);
    expect(weekday?.weekday).toBe(0);
    // Daily key is the local day (2026-09-07 in Tallinn).
    const day = out.daily.find((d) => d.checkIns > 0);
    expect(day?.date).toBe(localDay(started));
  });
});

/* -------------------------------------------------------------------------- */
/*                        /api/admin/analytics endpoint                       */
/* -------------------------------------------------------------------------- */

describe("GET /api/admin/analytics", () => {
  it("401s when logged out", async () => {
    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(
      new Request("http://x/api/admin/analytics?range=week"),
    );
    expect(res.status).toBe(401);
  });

  it("superuser sees data from every course", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    await prisma.checkIn.createMany({
      data: [
        {
          courseId: c1,
          deviceId: "d1",
          partySize: 2,
          startedAt: new Date(),
          lastPingAt: new Date(),
        },
        {
          courseId: c2,
          deviceId: "d2",
          partySize: 3,
          startedAt: new Date(),
          lastPingAt: new Date(),
        },
      ],
    });
    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(
      new Request("http://x/api/admin/analytics?range=week"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.checkIns).toBe(2);
    expect(body.summary.players).toBe(5);
    expect(body.courses.map((c: { courseId: string }) => c.courseId).sort()).toEqual(
      [c1, c2].sort(),
    );
  });

  it("courseAdmin only sees their assigned course", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    await prisma.checkIn.createMany({
      data: [
        {
          courseId: c1,
          deviceId: "d1",
          partySize: 2,
          startedAt: new Date(),
          lastPingAt: new Date(),
        },
        {
          courseId: c2,
          deviceId: "d2",
          partySize: 4,
          startedAt: new Date(),
          lastPingAt: new Date(),
        },
      ],
    });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);
    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(
      new Request("http://x/api/admin/analytics?range=week"),
    );
    const body = await res.json();
    expect(body.summary.checkIns).toBe(1);
    expect(body.summary.players).toBe(2);
    expect(body.courses).toHaveLength(1);
    expect(body.courses[0].courseId).toBe(c1);
  });

  it("includes a previousSummary computed from the immediately preceding window", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const now = new Date();
    // Two check-ins inside the current 7-day window.
    await prisma.checkIn.createMany({
      data: [
        {
          courseId: c1,
          deviceId: "d1",
          partySize: 2,
          startedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          lastPingAt: now,
        },
        {
          courseId: c1,
          deviceId: "d2",
          partySize: 3,
          startedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          lastPingAt: now,
        },
      ],
    });
    // One check-in inside the previous 7-day window (8 days ago).
    await prisma.checkIn.create({
      data: {
        courseId: c1,
        deviceId: "d3",
        partySize: 4,
        startedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
        lastPingAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      },
    });
    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(
      new Request("http://x/api/admin/analytics?range=week"),
    );
    const body = await res.json();
    expect(body.summary.players).toBe(5);
    expect(body.previousSummary).not.toBeNull();
    expect(body.previousSummary.players).toBe(4);
    expect(body.previousSummary.checkIns).toBe(1);
  });

  it("courseAdmin passing a focus courseId outside their scope sees nothing", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    await prisma.checkIn.create({
      data: {
        courseId: c2,
        deviceId: "d2",
        partySize: 4,
        startedAt: new Date(),
        lastPingAt: new Date(),
      },
    });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);
    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { GET } = await import("@/app/api/admin/analytics/route");
    const res = await GET(
      new Request(`http://x/api/admin/analytics?range=week&courseId=${c2}`),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.checkIns).toBe(0);
    expect(body.summary.players).toBe(0);
  });
});
