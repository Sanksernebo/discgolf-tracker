import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCookieStore, jsonRequest } from "../helpers";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  verifyPasswordHash,
  ROLE_COURSE_ADMIN,
} from "@/lib/admin";

const cookieStore = { current: makeCookieStore() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore.current,
}));

const sentMail: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendMail: async (msg: { to: string; subject: string; text: string }) => {
    sentMail.push(msg);
    return true;
  },
}));

beforeEach(() => {
  cookieStore.current = makeCookieStore();
  sentMail.length = 0;
});

const SUPERUSER_EMAIL = "admin@local";
const SUPERUSER_PW = "test-secret";

function loginRequest(email: string, password: string) {
  const req = jsonRequest("http://x/api/admin/login", { email, password });
  req.headers.set("x-forwarded-for", "203.0.113.7, 10.0.0.1");
  req.headers.set("user-agent", "TestBrowser/1.0");
  return req;
}

async function login(email: string, password: string) {
  const { POST } = await import("@/app/api/admin/login/route");
  return POST(loginRequest(email, password));
}

function linkToken(text: string): string {
  const m = text.match(/reset-password\?token=([0-9a-f]+)/);
  if (!m) throw new Error("no reset link in email");
  return m[1];
}

/* -------------------------------------------------------------------------- */
/*                                Login history                               */
/* -------------------------------------------------------------------------- */

describe("login history", () => {
  it("records successful logins with IP and user agent", async () => {
    await login(SUPERUSER_EMAIL, SUPERUSER_PW);
    const admin = await prisma.admin.findUniqueOrThrow({
      where: { email: SUPERUSER_EMAIL },
    });
    expect(admin.lastLoginAt).toBeTruthy();
    const events = await prisma.adminLoginEvent.findMany({
      where: { adminId: admin.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].ip).toBe("203.0.113.7");
    expect(events[0].userAgent).toBe("TestBrowser/1.0");
  });

  it("does not record failed logins", async () => {
    await login(SUPERUSER_EMAIL, SUPERUSER_PW);
    const res = await login(SUPERUSER_EMAIL, "wrong-password");
    expect(res.status).toBe(401);
    expect(await prisma.adminLoginEvent.count()).toBe(1);
  });

  it("lists history newest first for superusers", async () => {
    await login(SUPERUSER_EMAIL, SUPERUSER_PW);
    await login(SUPERUSER_EMAIL, SUPERUSER_PW);
    const admin = await prisma.admin.findUniqueOrThrow({
      where: { email: SUPERUSER_EMAIL },
    });
    const { GET } = await import("@/app/api/admin/admins/[id]/logins/route");
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: admin.id }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.logins).toHaveLength(2);
    expect(new Date(body.logins[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.logins[1].createdAt).getTime(),
    );

    const list = await (await import("@/app/api/admin/admins/route")).GET();
    const listed = (await list.json()).admins[0];
    expect(listed.lastLoginAt).toBeTruthy();
  });

  it("forbids course admins from reading history", async () => {
    await login(SUPERUSER_EMAIL, SUPERUSER_PW);
    const su = await prisma.admin.findUniqueOrThrow({
      where: { email: SUPERUSER_EMAIL },
    });
    await prisma.admin.create({
      data: {
        email: "ca@example.com",
        passwordHash: hashPassword("course-pw-1"),
        role: ROLE_COURSE_ADMIN,
      },
    });
    cookieStore.current = makeCookieStore();
    await login("ca@example.com", "course-pw-1");
    const { GET } = await import("@/app/api/admin/admins/[id]/logins/route");
    const res = await GET(new Request("http://x"), {
      params: Promise.resolve({ id: su.id }),
    });
    expect(res.status).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */
/*                                Display name                                */
/* -------------------------------------------------------------------------- */

describe("admin display name", () => {
  it("is saved on create and returned by /me", async () => {
    await login(SUPERUSER_EMAIL, SUPERUSER_PW);
    const { POST } = await import("@/app/api/admin/admins/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/admins", {
        email: "named@example.com",
        name: "Mari Maasikas",
        password: "longenough",
        role: ROLE_COURSE_ADMIN,
      }),
    );
    expect(res.status).toBe(200);

    cookieStore.current = makeCookieStore();
    await login("named@example.com", "longenough");
    const { GET } = await import("@/app/api/admin/me/route");
    const me = await (await GET()).json();
    expect(me.admin.name).toBe("Mari Maasikas");
  });
});

/* -------------------------------------------------------------------------- */
/*                               Password reset                               */
/* -------------------------------------------------------------------------- */

describe("password reset", () => {
  async function seedAdmin() {
    return prisma.admin.create({
      data: {
        email: "reset@example.com",
        passwordHash: hashPassword("old-password"),
        role: ROLE_COURSE_ADMIN,
      },
    });
  }

  async function forgot(email: string) {
    const { POST } = await import("@/app/api/admin/forgot-password/route");
    return POST(
      jsonRequest("http://x/api/admin/forgot-password", { email, locale: "en" }),
    );
  }

  async function reset(token: string, password: string) {
    const { POST } = await import("@/app/api/admin/reset-password/route");
    return POST(
      jsonRequest("http://x/api/admin/reset-password", { token, password }),
    );
  }

  it("responds the same for unknown emails and sends nothing", async () => {
    const res = await forgot("nobody@example.com");
    expect(res.status).toBe(200);
    expect(sentMail).toHaveLength(0);
  });

  it("emails a link whose token resets the password once", async () => {
    const admin = await seedAdmin();
    const res = await forgot("reset@example.com");
    expect(res.status).toBe(200);
    expect(sentMail).toHaveLength(1);
    expect(sentMail[0].to).toBe("reset@example.com");

    const token = linkToken(sentMail[0].text);
    // Only the hash is stored.
    const row = await prisma.passwordResetToken.findFirstOrThrow({
      where: { adminId: admin.id },
    });
    expect(row.tokenHash).not.toBe(token);

    expect((await reset(token, "brand-new-pw")).status).toBe(200);
    const updated = await prisma.admin.findUniqueOrThrow({
      where: { id: admin.id },
    });
    expect(verifyPasswordHash("brand-new-pw", updated.passwordHash)).toBe(true);

    // Single use.
    expect((await reset(token, "another-pw-1")).status).toBe(400);
  });

  it("rejects expired tokens", async () => {
    const admin = await seedAdmin();
    await forgot("reset@example.com");
    const token = linkToken(sentMail[0].text);
    await prisma.passwordResetToken.updateMany({
      where: { adminId: admin.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await reset(token, "brand-new-pw")).status).toBe(400);
  });

  it("rejects short passwords and unknown tokens", async () => {
    await seedAdmin();
    await forgot("reset@example.com");
    const token = linkToken(sentMail[0].text);
    expect((await reset(token, "short")).status).toBe(400);
    expect((await reset("deadbeef", "brand-new-pw")).status).toBe(400);
  });

  it("throttles repeat requests", async () => {
    await seedAdmin();
    await forgot("reset@example.com");
    await forgot("reset@example.com");
    expect(sentMail).toHaveLength(1);
  });
});
