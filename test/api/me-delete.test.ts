import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCookieStore, seedCourse } from "../helpers";
import { prisma } from "@/lib/prisma";
import {
  deleteDeviceData,
  pruneOldPersonalData,
} from "@/lib/data-deletion";

const cookieStore = { current: makeCookieStore() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore.current,
}));

beforeEach(() => {
  cookieStore.current = makeCookieStore();
});

/* -------------------------------------------------------------------------- */
/*                             Pure library helpers                            */
/* -------------------------------------------------------------------------- */

describe("deleteDeviceData", () => {
  it("removes every row keyed to the device (and nothing else)", async () => {
    const courseId = await seedCourse();
    await prisma.checkIn.createMany({
      data: [
        {
          courseId,
          deviceId: "mine",
          partySize: 2,
          startedAt: new Date(),
          lastPingAt: new Date(),
        },
        {
          courseId,
          deviceId: "someone-else",
          partySize: 1,
          startedAt: new Date(),
          lastPingAt: new Date(),
        },
      ],
    });
    await prisma.issueReport.createMany({
      data: [
        { courseId, category: "course", message: "mine", deviceId: "mine" },
        {
          courseId,
          category: "course",
          message: "not-mine",
          deviceId: "someone-else",
        },
      ],
    });
    await prisma.pushSubscription.create({
      data: {
        deviceId: "mine",
        endpoint: "https://push.example/mine",
        p256dh: "p",
        auth: "a",
      },
    });

    const out = await deleteDeviceData("mine");
    expect(out).toEqual({
      checkIns: 1,
      issueReports: 1,
      pushSubscriptions: 1,
    });
    expect(
      await prisma.checkIn.count({ where: { deviceId: "mine" } }),
    ).toBe(0);
    expect(
      await prisma.checkIn.count({ where: { deviceId: "someone-else" } }),
    ).toBe(1);
    expect(await prisma.issueReport.count()).toBe(1);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it("returns zero counts for an unknown device without failing", async () => {
    const out = await deleteDeviceData("does-not-exist");
    expect(out).toEqual({
      checkIns: 0,
      issueReports: 0,
      pushSubscriptions: 0,
    });
  });
});

describe("pruneOldPersonalData", () => {
  it("removes check-ins older than the retention window", async () => {
    const courseId = await seedCourse();
    const now = new Date("2026-09-11T12:00:00Z");
    const old = new Date(now);
    old.setMonth(old.getMonth() - 30); // 30 months old
    await prisma.checkIn.createMany({
      data: [
        {
          courseId,
          deviceId: "d1",
          partySize: 1,
          startedAt: old,
          lastPingAt: old,
          endedAt: old,
        },
        {
          courseId,
          deviceId: "d2",
          partySize: 1,
          startedAt: now,
          lastPingAt: now,
        },
      ],
    });
    const out = await pruneOldPersonalData(now, 24, 12);
    expect(out.checkIns).toBe(1);
    expect(await prisma.checkIn.count()).toBe(1);
    const remaining = await prisma.checkIn.findFirstOrThrow();
    expect(remaining.deviceId).toBe("d2");
  });

  it("only prunes closed issue reports past the window; open ones are kept", async () => {
    const courseId = await seedCourse();
    const now = new Date("2026-09-11T12:00:00Z");
    const old = new Date(now);
    old.setMonth(old.getMonth() - 18); // > 12 months
    await prisma.issueReport.createMany({
      data: [
        {
          courseId,
          category: "course",
          message: "old + closed",
          status: "closed",
          createdAt: old,
        },
        {
          courseId,
          category: "course",
          message: "old + open",
          status: "open",
          createdAt: old,
        },
        {
          courseId,
          category: "course",
          message: "recent",
          status: "closed",
          createdAt: now,
        },
      ],
    });
    const out = await pruneOldPersonalData(now, 24, 12);
    expect(out.issues).toBe(1);
    const rows = await prisma.issueReport.findMany({
      orderBy: { message: "asc" },
    });
    expect(rows.map((r) => r.message).sort()).toEqual(["old + open", "recent"]);
  });
});

/* -------------------------------------------------------------------------- */
/*                          POST /api/me/delete route                          */
/* -------------------------------------------------------------------------- */

describe("POST /api/me/delete", () => {
  it("clears the dg_device cookie and reports zero when nothing was there", async () => {
    const { POST } = await import("@/app/api/me/delete/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toEqual({
      checkIns: 0,
      issueReports: 0,
      pushSubscriptions: 0,
    });
  });

  it("deletes the calling device's rows and clears the cookie", async () => {
    const courseId = await seedCourse();
    // Seed the cookie the route will read.
    cookieStore.current = makeCookieStore({ dg_device: "abc" });
    await prisma.checkIn.create({
      data: {
        courseId,
        deviceId: "abc",
        partySize: 3,
        startedAt: new Date(),
        lastPingAt: new Date(),
      },
    });

    const { POST } = await import("@/app/api/me/delete/route");
    const res = await POST();
    const body = await res.json();
    expect(body.deleted.checkIns).toBe(1);
    expect(await prisma.checkIn.count({ where: { deviceId: "abc" } })).toBe(0);
    expect(cookieStore.current.get("dg_device")).toBeUndefined();
  });
});
