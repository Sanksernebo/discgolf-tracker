import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPasswordHash,
  canEditCourse,
  editableCourseIds,
  isSuperuser,
  ROLE_COURSE_ADMIN,
  ROLE_SUPERUSER,
} from "@/lib/admin";

describe("password hashing", () => {
  it("verifies a correct password", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPasswordHash("correct horse", stored)).toBe(true);
  });

  it("rejects the wrong password", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPasswordHash("battery staple", stored)).toBe(false);
  });

  it("rejects an empty stored hash", () => {
    expect(verifyPasswordHash("anything", null)).toBe(false);
    expect(verifyPasswordHash("anything", undefined)).toBe(false);
    expect(verifyPasswordHash("anything", "")).toBe(false);
  });

  it("rejects a malformed stored hash", () => {
    expect(verifyPasswordHash("anything", "noseparator")).toBe(false);
    expect(verifyPasswordHash("anything", ":onlysalt")).toBe(false);
  });

  it("produces different hashes for the same password (salted)", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(verifyPasswordHash("same-password", a)).toBe(true);
    expect(verifyPasswordHash("same-password", b)).toBe(true);
  });
});

describe("role helpers", () => {
  const superuser = { role: ROLE_SUPERUSER, courses: [] };
  const courseAdmin = {
    role: ROLE_COURSE_ADMIN,
    courses: [{ courseId: "c1" }, { courseId: "c2" }],
  };

  it("isSuperuser recognises the role", () => {
    expect(isSuperuser(superuser)).toBe(true);
    expect(isSuperuser(courseAdmin)).toBe(false);
    expect(isSuperuser(null)).toBe(false);
  });

  it("canEditCourse: superuser can edit anything", () => {
    expect(canEditCourse(superuser, "any-course-id")).toBe(true);
  });

  it("canEditCourse: course admin only for assigned courses", () => {
    expect(canEditCourse(courseAdmin, "c1")).toBe(true);
    expect(canEditCourse(courseAdmin, "c3")).toBe(false);
  });

  it("canEditCourse: nobody without a session", () => {
    expect(canEditCourse(null, "c1")).toBe(false);
  });

  it("editableCourseIds returns null for superuser (unbounded)", () => {
    expect(editableCourseIds(superuser)).toBeNull();
  });

  it("editableCourseIds returns list for course admin", () => {
    expect(editableCourseIds(courseAdmin)).toEqual(["c1", "c2"]);
  });

  it("editableCourseIds returns empty for unauthenticated", () => {
    expect(editableCourseIds(null)).toEqual([]);
  });
});
