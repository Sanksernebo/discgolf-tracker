import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  isSuperuser,
  hashPassword,
  ROLE_SUPERUSER,
  ROLE_COURSE_ADMIN,
} from "@/lib/admin";

const UpdateBody = z.object({
  email: z.string().email().max(200).optional(),
  password: z.string().min(8).max(200).optional(),
  role: z.enum([ROLE_SUPERUSER, ROLE_COURSE_ADMIN]).optional(),
  courseIds: z.array(z.string()).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperuser(admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const json = await req.json().catch(() => null);
  const parsed = UpdateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password, role, courseIds } = parsed.data;

  // Don't let a superuser demote or delete themselves out of the last
  // superuser slot — that would lock everyone out.
  const nextRole = role ?? target.role;
  if (target.role === ROLE_SUPERUSER && nextRole !== ROLE_SUPERUSER) {
    const otherSupers = await prisma.admin.count({
      where: { role: ROLE_SUPERUSER, id: { not: id } },
    });
    if (otherSupers === 0) {
      return NextResponse.json(
        { error: "last_superuser" },
        { status: 409 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (email) data.email = email.trim().toLowerCase();
  if (password) data.passwordHash = hashPassword(password);
  if (role) data.role = role;

  await prisma.$transaction([
    prisma.admin.update({ where: { id }, data }),
    // If courseIds is explicitly provided, replace assignments. Skip for
    // superusers because their assignments are meaningless (they see all).
    ...(courseIds !== undefined && nextRole === ROLE_COURSE_ADMIN
      ? [
          prisma.courseAdmin.deleteMany({ where: { adminId: id } }),
          prisma.courseAdmin.createMany({
            data: courseIds.map((cid) => ({ courseId: cid, adminId: id })),
          }),
        ]
      : nextRole === ROLE_SUPERUSER
        ? [prisma.courseAdmin.deleteMany({ where: { adminId: id } })]
        : []),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperuser(admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (target.role === ROLE_SUPERUSER) {
    const otherSupers = await prisma.admin.count({
      where: { role: ROLE_SUPERUSER, id: { not: id } },
    });
    if (otherSupers === 0) {
      return NextResponse.json({ error: "last_superuser" }, { status: 409 });
    }
  }
  if (target.id === admin.id) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 409 });
  }
  await prisma.admin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
