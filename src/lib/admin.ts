import { cookies } from "next/headers";
import {
  createHmac,
  timingSafeEqual,
  scryptSync,
  randomBytes,
} from "crypto";
import type { Admin } from "@prisma/client";
import { prisma } from "./prisma";

const COOKIE_NAME = "dg_admin";
const ONE_DAY = 60 * 60 * 24;

export const ROLE_SUPERUSER = "superuser";
export const ROLE_COURSE_ADMIN = "courseAdmin";
export type AdminRole = typeof ROLE_SUPERUSER | typeof ROLE_COURSE_ADMIN;

/* -------------------------------------------------------------------------- */
/*                              Password hashing                              */
/* -------------------------------------------------------------------------- */

/** Store as "<salt-hex>:<hash-hex>". Node scrypt, N=16384 (default), key=64B. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  let check: Buffer;
  try {
    check = scryptSync(password, salt, 64);
  } catch {
    return false;
  }
  const a = Buffer.from(hash, "hex");
  if (a.length !== check.length) return false;
  return timingSafeEqual(a, check);
}

/* -------------------------------------------------------------------------- */
/*                             Session cookie IO                              */
/* -------------------------------------------------------------------------- */

function sessionSecret(): string {
  // ADMIN_PASSWORD doubles as the HMAC secret so rotating it invalidates
  // outstanding sessions. This is intentional and documented.
  return process.env.ADMIN_PASSWORD ?? "admin123";
}

function sign(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("hex");
}

function serialiseSession(adminId: string): string {
  return `${adminId}.${sign(adminId)}`;
}

function parseSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const idx = raw.indexOf(".");
  if (idx <= 0) return null;
  const id = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(id);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? id : null;
  } catch {
    return null;
  }
}

async function setAdminSession(adminId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, serialiseSession(adminId), {
    maxAge: ONE_DAY,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/* -------------------------------------------------------------------------- */
/*                             Bootstrap superuser                            */
/* -------------------------------------------------------------------------- */

function superuserEmail(): string {
  return (process.env.SUPERUSER_EMAIL ?? "admin@local").toLowerCase();
}

/**
 * If the DB has no admins yet AND the supplied credentials match the
 * environment-configured bootstrap superuser (SUPERUSER_EMAIL + ADMIN_PASSWORD),
 * create the superuser account so the app is usable on a fresh install.
 */
async function maybeBootstrapSuperuser(
  email: string,
  password: string,
): Promise<Admin | null> {
  const count = await prisma.admin.count();
  if (count > 0) return null;
  if (email.toLowerCase() !== superuserEmail()) return null;
  if (password !== (process.env.ADMIN_PASSWORD ?? "admin123")) return null;
  return prisma.admin.create({
    data: {
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: ROLE_SUPERUSER,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                 Auth entry                                 */
/* -------------------------------------------------------------------------- */

/** Sign in with email + password. Returns the Admin on success, null otherwise. */
export async function signIn(
  email: string,
  password: string,
): Promise<Admin | null> {
  const normalised = email.trim().toLowerCase();

  const bootstrapped = await maybeBootstrapSuperuser(normalised, password);
  if (bootstrapped) {
    await setAdminSession(bootstrapped.id);
    return bootstrapped;
  }

  const admin = await prisma.admin.findUnique({
    where: { email: normalised },
  });
  if (!admin) return null;
  if (!verifyPasswordHash(password, admin.passwordHash)) return null;

  await setAdminSession(admin.id);
  return admin;
}

/* -------------------------------------------------------------------------- */
/*                             Session inspection                             */
/* -------------------------------------------------------------------------- */

/** Return the current admin (with course assignments) or null. */
export async function getCurrentAdmin() {
  const store = await cookies();
  const id = parseSession(store.get(COOKIE_NAME)?.value);
  if (!id) return null;
  return prisma.admin.findUnique({
    where: { id },
    include: {
      courses: { select: { courseId: true } },
    },
  });
}

/** Cheap "any admin logged in?" for gating pages / hiding nav. */
export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return parseSession(store.get(COOKIE_NAME)?.value) !== null;
}

export function isSuperuser(admin: { role: string } | null): boolean {
  return admin?.role === ROLE_SUPERUSER;
}

/** True if the admin may edit the given course. */
export function canEditCourse(
  admin: ({ role: string; courses: { courseId: string }[] } | null),
  courseId: string,
): boolean {
  if (!admin) return false;
  if (admin.role === ROLE_SUPERUSER) return true;
  return admin.courses.some((c) => c.courseId === courseId);
}

/** Set of course ids the admin may see/edit, or null for "all" (superuser). */
export function editableCourseIds(
  admin: { role: string; courses: { courseId: string }[] } | null,
): string[] | null {
  if (!admin) return [];
  if (admin.role === ROLE_SUPERUSER) return null;
  return admin.courses.map((c) => c.courseId);
}
