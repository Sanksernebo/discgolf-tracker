import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCookieStore, jsonRequest, seedCourse } from "../helpers";
import { prisma } from "@/lib/prisma";

const cookieStore = { current: makeCookieStore() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore.current,
}));

beforeEach(() => {
  cookieStore.current = makeCookieStore();
});

describe("POST /api/issues", () => {
  it("400s on missing category", async () => {
    const { POST } = await import("@/app/api/issues/route");
    const res = await POST(
      jsonRequest("http://x/api/issues", { message: "hi" }),
    );
    expect(res.status).toBe(400);
  });

  it("400s on message shorter than 3 chars", async () => {
    const { POST } = await import("@/app/api/issues/route");
    const res = await POST(
      jsonRequest("http://x/api/issues", { category: "app", message: "no" }),
    );
    expect(res.status).toBe(400);
  });

  it("400s on unknown category", async () => {
    const { POST } = await import("@/app/api/issues/route");
    const res = await POST(
      jsonRequest("http://x/api/issues", {
        category: "spam",
        message: "hello",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates an app-level issue with no course id", async () => {
    const { POST } = await import("@/app/api/issues/route");
    const res = await POST(
      jsonRequest("http://x/api/issues", {
        category: "app",
        message: "login button doesn't work",
      }),
    );
    expect(res.status).toBe(200);

    const rows = await prisma.issueReport.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].courseId).toBeNull();
    expect(rows[0].category).toBe("app");
    expect(rows[0].status).toBe("open");
  });

  it("attaches the device id when a cookie is present", async () => {
    cookieStore.current.set("dg_device", "abc123");

    const { POST } = await import("@/app/api/issues/route");
    const courseId = await seedCourse();
    await POST(
      jsonRequest("http://x/api/issues", {
        courseId,
        category: "course",
        message: "hole 5 chains broken",
      }),
    );

    const row = await prisma.issueReport.findFirstOrThrow();
    expect(row.deviceId).toBe("abc123");
    expect(row.courseId).toBe(courseId);
  });
});

describe("GET /api/issues (admin)", () => {
  it("401s when not authenticated", async () => {
    const { GET } = await import("@/app/api/issues/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
