import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeCookieStore, jsonRequest, seedCourse } from "../helpers";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  ROLE_COURSE_ADMIN,
  ROLE_SUPERUSER,
} from "@/lib/admin";

const cookieStore = { current: makeCookieStore() };
vi.mock("next/headers", () => ({
  cookies: async () => cookieStore.current,
}));

beforeEach(() => {
  cookieStore.current = makeCookieStore();
});

const SUPERUSER_EMAIL = "admin@local"; // matches default in signIn bootstrap
const SUPERUSER_PW = "test-secret"; // matches vitest.config.ts ADMIN_PASSWORD

/** Sign in via the real route; bootstraps the superuser on first call. */
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

async function createCourseAdmin(email: string, password: string, courseIds: string[] = []) {
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
/*                                    Login                                   */
/* -------------------------------------------------------------------------- */

describe("POST /api/admin/login", () => {
  it("400s on missing fields", async () => {
    const { POST } = await import("@/app/api/admin/login/route");
    const res = await POST(jsonRequest("http://x/api/admin/login", {}));
    expect(res.status).toBe(400);
  });

  it("bootstraps a superuser on first login with env credentials", async () => {
    await loginAsSuperuser();
    const admins = await prisma.admin.findMany();
    expect(admins).toHaveLength(1);
    expect(admins[0].role).toBe(ROLE_SUPERUSER);
    expect(admins[0].email).toBe(SUPERUSER_EMAIL);
    expect(cookieStore.current.get("dg_admin")?.value).toBeTruthy();
  });

  it("does NOT bootstrap again once admins exist", async () => {
    await loginAsSuperuser();
    // Now try a different email with the env password — must not create a
    // second superuser.
    const { POST } = await import("@/app/api/admin/login/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/login", {
        email: "not-super@example.com",
        password: SUPERUSER_PW,
      }),
    );
    expect(res.status).toBe(401);
    expect(await prisma.admin.count()).toBe(1);
  });

  it("401s on wrong password after bootstrap", async () => {
    await loginAsSuperuser();
    cookieStore.current = makeCookieStore();
    const { POST } = await import("@/app/api/admin/login/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/login", {
        email: SUPERUSER_EMAIL,
        password: "wrong",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("logs in a courseAdmin created by the superuser", async () => {
    await loginAsSuperuser();
    await createCourseAdmin("clerk@example.com", "hunter2-strong");
    cookieStore.current = makeCookieStore();
    await loginAs("clerk@example.com", "hunter2-strong");
    expect(cookieStore.current.get("dg_admin")?.value).toBeTruthy();
  });
});

describe("POST /api/admin/logout", () => {
  it("clears the admin cookie", async () => {
    await loginAsSuperuser();
    const { POST } = await import("@/app/api/admin/logout/route");
    await POST();
    expect(cookieStore.current.get("dg_admin")).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*                                /api/admin/me                               */
/* -------------------------------------------------------------------------- */

describe("GET /api/admin/me", () => {
  it("returns null admin when logged out", async () => {
    const { GET } = await import("@/app/api/admin/me/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.admin).toBeNull();
  });

  it("returns role + assigned course ids", async () => {
    await loginAsSuperuser();
    const cid = await seedCourse();
    const ca = await createCourseAdmin("ca@example.com", "strong-password", [cid]);
    cookieStore.current = makeCookieStore();
    await loginAs("ca@example.com", "strong-password");
    const { GET } = await import("@/app/api/admin/me/route");
    const res = await GET();
    const body = await res.json();
    expect(body.admin.id).toBe(ca.id);
    expect(body.admin.role).toBe(ROLE_COURSE_ADMIN);
    expect(body.admin.courseIds).toEqual([cid]);
  });
});

/* -------------------------------------------------------------------------- */
/*                          Course access by role                             */
/* -------------------------------------------------------------------------- */

describe("Course access by role", () => {
  const goodCourse = {
    nameEt: "Uus rada",
    nameEn: "New course",
    county: "harju",
    city: "Tallinn",
    latitude: 59.4,
    longitude: 24.75,
    holes: [
      { number: 1, par: 3, distance: 50 },
      { number: 2, par: 3, distance: 60 },
    ],
  };

  it("courseAdmin GET only sees assigned courses", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "Assigned" });
    const c2 = await seedCourse({ nameEt: "Other" });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { GET } = await import("@/app/api/admin/courses/route");
    const res = await GET();
    const body = await res.json();
    expect(body.courses.map((c: { id: string }) => c.id)).toEqual([c1]);
    expect(body.courses.map((c: { id: string }) => c.id)).not.toContain(c2);
  });

  it("courseAdmin cannot create a course", async () => {
    await loginAsSuperuser();
    await createCourseAdmin("ca@ex.com", "strong-password");

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { POST } = await import("@/app/api/admin/courses/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/courses", goodCourse),
    );
    expect(res.status).toBe(403);
  });

  it("courseAdmin cannot edit an unassigned course", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "Assigned" });
    const other = await seedCourse({ nameEt: "Other" });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { PUT } = await import("@/app/api/admin/courses/[id]/route");
    const res = await PUT(
      jsonRequest(
        `http://x/api/admin/courses/${other}`,
        { ...goodCourse, nameEt: "Hijack" },
        "PUT",
      ),
      { params: Promise.resolve({ id: other }) },
    );
    expect(res.status).toBe(403);
  });

  it("courseAdmin can edit an assigned course", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "Assigned" });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { PUT } = await import("@/app/api/admin/courses/[id]/route");
    const res = await PUT(
      jsonRequest(
        `http://x/api/admin/courses/${c1}`,
        { ...goodCourse, nameEt: "Renamed by admin" },
        "PUT",
      ),
      { params: Promise.resolve({ id: c1 }) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.course.findUniqueOrThrow({ where: { id: c1 } });
    expect(after.nameEt).toBe("Renamed by admin");
  });

  it("courseAdmin cannot DELETE any course", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "Assigned" });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { DELETE } = await import("@/app/api/admin/courses/[id]/route");
    const res = await DELETE(
      new Request(`http://x/api/admin/courses/${c1}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: c1 }) },
    );
    expect(res.status).toBe(403);
    expect(await prisma.course.count()).toBe(1);
  });

  it("superuser can create, edit and delete", async () => {
    await loginAsSuperuser();
    const cid = await seedCourse();
    const { PUT, DELETE } = await import("@/app/api/admin/courses/[id]/route");

    const put = await PUT(
      jsonRequest(
        `http://x/api/admin/courses/${cid}`,
        { ...goodCourse, nameEt: "Super rename" },
        "PUT",
      ),
      { params: Promise.resolve({ id: cid }) },
    );
    expect(put.status).toBe(200);

    const del = await DELETE(
      new Request(`http://x/api/admin/courses/${cid}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: cid }) },
    );
    expect(del.status).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */
/*                             Admin management                               */
/* -------------------------------------------------------------------------- */

describe("Admin management API (/api/admin/admins)", () => {
  it("blocks non-superuser", async () => {
    await loginAsSuperuser();
    await createCourseAdmin("ca@ex.com", "strong-password");
    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { GET, POST } = await import("@/app/api/admin/admins/route");
    expect((await GET()).status).toBe(403);
    expect(
      (
        await POST(
          jsonRequest("http://x/api/admin/admins", {
            email: "x@y.com",
            password: "abcdefgh",
            role: "courseAdmin",
          }),
        )
      ).status,
    ).toBe(403);
  });

  it("superuser lists admins", async () => {
    await loginAsSuperuser();
    await createCourseAdmin("ca@ex.com", "strong-password");

    const { GET } = await import("@/app/api/admin/admins/route");
    const res = await GET();
    const body = await res.json();
    expect(body.admins).toHaveLength(2);
    expect(body.admins.map((a: { email: string }) => a.email).sort()).toEqual([
      SUPERUSER_EMAIL,
      "ca@ex.com",
    ]);
  });

  it("superuser creates a course admin with assignments", async () => {
    await loginAsSuperuser();
    const cid = await seedCourse();

    const { POST } = await import("@/app/api/admin/admins/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/admins", {
        email: "New@Example.COM",
        password: "verystrongpw",
        role: "courseAdmin",
        courseIds: [cid],
      }),
    );
    expect(res.status).toBe(200);
    const created = await prisma.admin.findUniqueOrThrow({
      where: { email: "new@example.com" },
      include: { courses: true },
    });
    expect(created.role).toBe(ROLE_COURSE_ADMIN);
    expect(created.courses.map((c) => c.courseId)).toEqual([cid]);
  });

  it("rejects duplicate email with 409", async () => {
    await loginAsSuperuser();
    await createCourseAdmin("dup@ex.com", "strong-password");

    const { POST } = await import("@/app/api/admin/admins/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/admins", {
        email: "dup@ex.com",
        password: "another-strong-pw",
        role: "courseAdmin",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("rejects password < 8 chars", async () => {
    await loginAsSuperuser();
    const { POST } = await import("@/app/api/admin/admins/route");
    const res = await POST(
      jsonRequest("http://x/api/admin/admins", {
        email: "short@ex.com",
        password: "short",
        role: "courseAdmin",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("PUT can rewrite course assignments and change role", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    const ca = await createCourseAdmin("mv@ex.com", "strong-password", [c1]);

    const { PUT } = await import("@/app/api/admin/admins/[id]/route");
    const res = await PUT(
      jsonRequest(
        `http://x/api/admin/admins/${ca.id}`,
        { courseIds: [c2] },
        "PUT",
      ),
      { params: Promise.resolve({ id: ca.id }) },
    );
    expect(res.status).toBe(200);
    const after = await prisma.courseAdmin.findMany({
      where: { adminId: ca.id },
    });
    expect(after.map((r) => r.courseId)).toEqual([c2]);
  });

  it("prevents demoting the last superuser", async () => {
    await loginAsSuperuser();
    const me = await prisma.admin.findFirstOrThrow({
      where: { role: ROLE_SUPERUSER },
    });
    const { PUT } = await import("@/app/api/admin/admins/[id]/route");
    const res = await PUT(
      jsonRequest(
        `http://x/api/admin/admins/${me.id}`,
        { role: "courseAdmin" },
        "PUT",
      ),
      { params: Promise.resolve({ id: me.id }) },
    );
    expect(res.status).toBe(409);
  });

  it("prevents deleting yourself", async () => {
    await loginAsSuperuser();
    const me = await prisma.admin.findFirstOrThrow({
      where: { role: ROLE_SUPERUSER },
    });
    const { DELETE } = await import("@/app/api/admin/admins/[id]/route");
    const res = await DELETE(
      new Request(`http://x/api/admin/admins/${me.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: me.id }) },
    );
    expect(res.status).toBe(409);
  });

  it("deletes a course admin cleanly", async () => {
    await loginAsSuperuser();
    const ca = await createCourseAdmin("gone@ex.com", "strong-password");
    const { DELETE } = await import("@/app/api/admin/admins/[id]/route");
    const res = await DELETE(
      new Request(`http://x/api/admin/admins/${ca.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: ca.id }) },
    );
    expect(res.status).toBe(200);
    expect(await prisma.admin.count()).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/*                        Issue access by role                                */
/* -------------------------------------------------------------------------- */

describe("Issue access by role", () => {
  it("courseAdmin only sees issues on their courses (no app-level)", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    await prisma.issueReport.createMany({
      data: [
        { courseId: c1, category: "course", message: "on c1" },
        { courseId: c2, category: "course", message: "on c2" },
        { courseId: null, category: "app", message: "app-level" },
      ],
    });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { GET } = await import("@/app/api/issues/route");
    const res = await GET();
    const body = await res.json();
    const messages = body.issues.map((i: { message: string }) => i.message);
    expect(messages).toEqual(["on c1"]);
  });

  it("courseAdmin PATCH forbidden on other course's issue", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const c2 = await seedCourse({ nameEt: "B" });
    const issue = await prisma.issueReport.create({
      data: { courseId: c2, category: "course", message: "not yours" },
    });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { PATCH } = await import("@/app/api/admin/issues/[id]/route");
    const res = await PATCH(
      jsonRequest(
        `http://x/api/admin/issues/${issue.id}`,
        { status: "closed" },
        "PATCH",
      ),
      { params: Promise.resolve({ id: issue.id }) },
    );
    expect(res.status).toBe(403);
  });

  it("courseAdmin PATCH allowed on their course's issue", async () => {
    await loginAsSuperuser();
    const c1 = await seedCourse({ nameEt: "A" });
    const issue = await prisma.issueReport.create({
      data: { courseId: c1, category: "course", message: "mine" },
    });
    await createCourseAdmin("ca@ex.com", "strong-password", [c1]);

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { PATCH } = await import("@/app/api/admin/issues/[id]/route");
    const res = await PATCH(
      jsonRequest(
        `http://x/api/admin/issues/${issue.id}`,
        { status: "closed" },
        "PATCH",
      ),
      { params: Promise.resolve({ id: issue.id }) },
    );
    expect(res.status).toBe(200);
  });

  it("app-level issue is superuser-only via PATCH", async () => {
    await loginAsSuperuser();
    const issue = await prisma.issueReport.create({
      data: { category: "app", message: "hidden" },
    });
    await createCourseAdmin("ca@ex.com", "strong-password");

    cookieStore.current = makeCookieStore();
    await loginAs("ca@ex.com", "strong-password");

    const { PATCH } = await import("@/app/api/admin/issues/[id]/route");
    const res = await PATCH(
      jsonRequest(
        `http://x/api/admin/issues/${issue.id}`,
        { status: "closed" },
        "PATCH",
      ),
      { params: Promise.resolve({ id: issue.id }) },
    );
    expect(res.status).toBe(403);
  });
});
