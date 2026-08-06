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

const CreateBody = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  role: z.enum([ROLE_SUPERUSER, ROLE_COURSE_ADMIN]),
  courseIds: z.array(z.string()).optional(),
});

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperuser(admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admins = await prisma.admin.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    include: {
      courses: {
        select: {
          courseId: true,
          course: { select: { nameEt: true, nameEn: true } },
        },
      },
    },
  });
  return NextResponse.json({
    admins: admins.map((a) => ({
      id: a.id,
      email: a.email,
      role: a.role,
      createdAt: a.createdAt,
      courses: a.courses.map((c) => ({
        id: c.courseId,
        nameEt: c.course.nameEt,
        nameEn: c.course.nameEn,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperuser(admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, password, role, courseIds } = parsed.data;
  const normalisedEmail = email.trim().toLowerCase();
  const existing = await prisma.admin.findUnique({
    where: { email: normalisedEmail },
  });
  if (existing) {
    return NextResponse.json(
      { error: "email_taken" },
      { status: 409 },
    );
  }
  const created = await prisma.admin.create({
    data: {
      email: normalisedEmail,
      passwordHash: hashPassword(password),
      role,
      courses:
        role === ROLE_COURSE_ADMIN && courseIds?.length
          ? { create: courseIds.map((cid) => ({ courseId: cid })) }
          : undefined,
    },
  });
  return NextResponse.json({ id: created.id });
}
