import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCookieStore, jsonRequest, seedCourse } from "../helpers";
import { prisma } from "@/lib/prisma";
import { ACTIVE_WINDOW_MINUTES } from "@/lib/constants";

// Provide a controllable cookies() implementation before importing any route
// module that pulls in next/headers.
const cookieStore = { current: makeCookieStore() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore.current,
}));

beforeEach(() => {
  cookieStore.current = makeCookieStore();
});

describe("POST /api/checkin", () => {
  it("400s on missing body", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const res = await POST(jsonRequest("http://x/api/checkin", {}));
    expect(res.status).toBe(400);
  });

  it("404s on unknown course id", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const res = await POST(
      jsonRequest("http://x/api/checkin", { courseId: "nope" }),
    );
    expect(res.status).toBe(404);
  });

  it("creates a check-in and sets the device cookie for a new visitor", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const courseId = await seedCourse();

    const res = await POST(jsonRequest("http://x/api/checkin", { courseId }));
    expect(res.status).toBe(200);

    const rows = await prisma.checkIn.findMany({ where: { courseId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].endedAt).toBeNull();
    // Defaults to a party of 1 when the client doesn't specify.
    expect(rows[0].partySize).toBe(1);

    // Cookie was minted for the fresh device.
    expect(cookieStore.current.get("dg_device")?.value).toBeTruthy();
    expect(cookieStore.current.get("dg_device")?.value).toBe(rows[0].deviceId);
  });

  it("creates a check-in with the specified party size", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const courseId = await seedCourse();

    const res = await POST(
      jsonRequest("http://x/api/checkin", { courseId, partySize: 4 }),
    );
    expect(res.status).toBe(200);
    const row = await prisma.checkIn.findFirstOrThrow({ where: { courseId } });
    expect(row.partySize).toBe(4);
  });

  it("updates party size on repeat check-in for the same course", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const courseId = await seedCourse();

    await POST(jsonRequest("http://x/api/checkin", { courseId, partySize: 2 }));
    const first = await prisma.checkIn.findFirstOrThrow({ where: { courseId } });
    expect(first.partySize).toBe(2);

    // Bump the group up
    await POST(jsonRequest("http://x/api/checkin", { courseId, partySize: 5 }));
    const after = await prisma.checkIn.findMany({ where: { courseId } });
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(first.id);
    expect(after[0].partySize).toBe(5);
  });

  it("rejects a party size above the cap", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const courseId = await seedCourse();

    const res = await POST(
      jsonRequest("http://x/api/checkin", { courseId, partySize: 999 }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a party size below 1", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const courseId = await seedCourse();

    const res = await POST(
      jsonRequest("http://x/api/checkin", { courseId, partySize: 0 }),
    );
    expect(res.status).toBe(400);
  });

  it("refreshes lastPingAt when re-checking-in on the same course", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const courseId = await seedCourse();

    // First check-in creates the row & the cookie.
    await POST(jsonRequest("http://x/api/checkin", { courseId }));
    const deviceId = cookieStore.current.get("dg_device")!.value;
    const first = await prisma.checkIn.findFirstOrThrow({ where: { courseId } });

    // Rewind lastPingAt so we can detect a bump.
    const earlier = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.checkIn.update({
      where: { id: first.id },
      data: { lastPingAt: earlier },
    });

    await POST(jsonRequest("http://x/api/checkin", { courseId }));

    const after = await prisma.checkIn.findMany({ where: { courseId } });
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(first.id);
    expect(after[0].deviceId).toBe(deviceId);
    expect(after[0].lastPingAt.getTime()).toBeGreaterThan(earlier.getTime());
  });

  it("ends stale sessions on other courses before creating a new one", async () => {
    const { POST } = await import("@/app/api/checkin/route");
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });

    await POST(jsonRequest("http://x/api/checkin", { courseId: c1 }));
    const deviceId = cookieStore.current.get("dg_device")!.value;

    await POST(jsonRequest("http://x/api/checkin", { courseId: c2 }));

    const sessions = await prisma.checkIn.findMany({
      where: { deviceId },
      orderBy: { startedAt: "asc" },
    });
    expect(sessions).toHaveLength(2);

    const onC1 = sessions.find((s) => s.courseId === c1)!;
    const onC2 = sessions.find((s) => s.courseId === c2)!;
    expect(onC1.endedAt).not.toBeNull();
    expect(onC2.endedAt).toBeNull();
  });
});

describe("POST /api/ping", () => {
  it("responds active:false when there is no device cookie", async () => {
    const { POST } = await import("@/app/api/ping/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  it("responds active:false when the session is stale", async () => {
    const { POST: pingPOST } = await import("@/app/api/ping/route");
    const courseId = await seedCourse();
    const deviceId = "deadbeef";
    cookieStore.current.set("dg_device", deviceId);

    const stale = new Date(
      Date.now() - (ACTIVE_WINDOW_MINUTES + 10) * 60 * 1000,
    );
    await prisma.checkIn.create({
      data: { courseId, deviceId, startedAt: stale, lastPingAt: stale },
    });

    const res = await pingPOST();
    const body = await res.json();
    expect(body.active).toBe(false);
  });

  it("bumps lastPingAt and returns active:true for a live session", async () => {
    const { POST: checkinPOST } = await import("@/app/api/checkin/route");
    const { POST: pingPOST } = await import("@/app/api/ping/route");

    const courseId = await seedCourse();
    await checkinPOST(jsonRequest("http://x/api/checkin", { courseId }));

    const before = await prisma.checkIn.findFirstOrThrow({ where: { courseId } });
    // Rewind so we can prove the ping updated the timestamp.
    const earlier = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.checkIn.update({
      where: { id: before.id },
      data: { lastPingAt: earlier },
    });

    const res = await pingPOST();
    const body = await res.json();
    expect(body.active).toBe(true);

    const after = await prisma.checkIn.findFirstOrThrow({ where: { id: before.id } });
    expect(after.lastPingAt.getTime()).toBeGreaterThan(earlier.getTime());
  });
});

describe("POST /api/checkout", () => {
  it("ends any active sessions for the device", async () => {
    const { POST: checkinPOST } = await import("@/app/api/checkin/route");
    const { POST: checkoutPOST } = await import("@/app/api/checkout/route");

    const courseId = await seedCourse();
    await checkinPOST(jsonRequest("http://x/api/checkin", { courseId }));
    const deviceId = cookieStore.current.get("dg_device")!.value;

    let active = await prisma.checkIn.findMany({
      where: { deviceId, endedAt: null },
    });
    expect(active).toHaveLength(1);

    const res = await checkoutPOST();
    expect(res.status).toBe(200);

    active = await prisma.checkIn.findMany({
      where: { deviceId, endedAt: null },
    });
    expect(active).toHaveLength(0);
  });

  it("is a no-op when there is no device cookie", async () => {
    const { POST } = await import("@/app/api/checkout/route");
    const res = await POST();
    expect(res.status).toBe(200);
  });
});
