import { describe, it, expect } from "vitest";
import {
  activeSinceThreshold,
  getActiveCountsByCourse,
  getActiveCheckInForDevice,
} from "@/lib/traffic";
import { ACTIVE_WINDOW_MINUTES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { seedCourse } from "../helpers";

const MINUTE = 60 * 1000;

describe("activeSinceThreshold", () => {
  it("returns ACTIVE_WINDOW_MINUTES ago", () => {
    const before = Date.now();
    const t = activeSinceThreshold().getTime();
    const after = Date.now();
    // Within a small tolerance of window ago
    expect(t).toBeGreaterThanOrEqual(before - ACTIVE_WINDOW_MINUTES * MINUTE);
    expect(t).toBeLessThanOrEqual(after - ACTIVE_WINDOW_MINUTES * MINUTE);
  });
});

describe("getActiveCountsByCourse", () => {
  it("sums partySize of check-ins that are unended AND pinged within the window", async () => {
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });

    const now = new Date();
    const stale = new Date(now.getTime() - (ACTIVE_WINDOW_MINUTES + 10) * MINUTE);

    await prisma.checkIn.createMany({
      data: [
        // active on c1: solo + a group of 3 => 4
        { courseId: c1, deviceId: "d1", startedAt: now, lastPingAt: now, partySize: 1 },
        { courseId: c1, deviceId: "d2", startedAt: now, lastPingAt: now, partySize: 3 },
        // ended -> not counted (even if partySize is huge)
        {
          courseId: c1,
          deviceId: "d3",
          startedAt: now,
          lastPingAt: now,
          endedAt: now,
          partySize: 8,
        },
        // stale ping -> not counted
        { courseId: c1, deviceId: "d4", startedAt: stale, lastPingAt: stale, partySize: 5 },
        // active on c2
        { courseId: c2, deviceId: "d5", startedAt: now, lastPingAt: now, partySize: 2 },
      ],
    });

    const counts = await getActiveCountsByCourse([c1, c2]);
    expect(counts[c1]).toBe(4);
    expect(counts[c2]).toBe(2);
  });

  it("zero-fills courses that have no active check-ins when ids are supplied", async () => {
    const c1 = await seedCourse();
    const counts = await getActiveCountsByCourse([c1]);
    expect(counts[c1]).toBe(0);
  });

  it("omits zero-fill when no ids are supplied", async () => {
    const counts = await getActiveCountsByCourse();
    expect(counts).toEqual({});
  });
});

describe("getActiveCheckInForDevice", () => {
  it("returns the active session for a device, most recent first", async () => {
    const c1 = await seedCourse();
    const now = new Date();
    const older = new Date(now.getTime() - 30 * MINUTE);

    await prisma.checkIn.createMany({
      data: [
        { courseId: c1, deviceId: "d1", startedAt: older, lastPingAt: older },
        { courseId: c1, deviceId: "d1", startedAt: now, lastPingAt: now },
      ],
    });

    const found = await getActiveCheckInForDevice("d1");
    expect(found).not.toBeNull();
    expect(found!.startedAt.getTime()).toBe(now.getTime());
  });

  it("returns null when device has only stale or ended sessions", async () => {
    const c1 = await seedCourse();
    const now = new Date();
    const stale = new Date(now.getTime() - (ACTIVE_WINDOW_MINUTES + 5) * MINUTE);

    await prisma.checkIn.createMany({
      data: [
        {
          courseId: c1,
          deviceId: "dead",
          startedAt: now,
          lastPingAt: now,
          endedAt: now,
        },
        { courseId: c1, deviceId: "dead", startedAt: stale, lastPingAt: stale },
      ],
    });

    const found = await getActiveCheckInForDevice("dead");
    expect(found).toBeNull();
  });

  it("filters by course when courseId is supplied", async () => {
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    const now = new Date();
    await prisma.checkIn.create({
      data: { courseId: c1, deviceId: "d1", startedAt: now, lastPingAt: now },
    });

    expect(await getActiveCheckInForDevice("d1", c2)).toBeNull();
    expect(await getActiveCheckInForDevice("d1", c1)).not.toBeNull();
  });
});
