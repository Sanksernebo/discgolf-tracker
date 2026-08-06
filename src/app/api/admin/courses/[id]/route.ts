import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  isSuperuser,
  canEditCourse,
} from "@/lib/admin";

const HoleInput = z.object({
  number: z.number().int().min(1).max(50),
  par: z.number().int().min(1).max(10),
  distance: z.number().int().min(0).max(2000).nullable().optional(),
});

const CourseBody = z.object({
  nameEt: z.string().min(1).max(200),
  nameEn: z.string().min(1).max(200),
  county: z.string().min(1),
  city: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  descriptionEt: z.string().max(2000).nullable().optional(),
  descriptionEn: z.string().max(2000).nullable().optional(),
  holes: z.array(HoleInput).min(1).max(50),
  // Only honoured for superuser updates.
  assignedAdminIds: z.array(z.string()).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!canEditCourse(admin, id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const json = await req.json().catch(() => null);
  const parsed = CourseBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { holes, assignedAdminIds, ...data } = parsed.data;

  const ops = [
    prisma.hole.deleteMany({ where: { courseId: id } }),
    prisma.course.update({
      where: { id },
      data: {
        ...data,
        holes: {
          create: holes.map((h) => ({ ...h, distance: h.distance ?? null })),
        },
      },
    }),
  ];

  // Only superuser can rewrite course-admin assignments.
  if (isSuperuser(admin) && assignedAdminIds) {
    ops.push(
      prisma.courseAdmin.deleteMany({ where: { courseId: id } }),
      // Prisma types differ across ops; each is a valid PrismaPromise.
      prisma.courseAdmin.createMany({
        data: assignedAdminIds.map((adminId) => ({ courseId: id, adminId })),
      }) as never,
    );
  }

  await prisma.$transaction(ops);

  const updated = await prisma.course.findUnique({
    where: { id },
    include: {
      holes: { orderBy: { number: "asc" } },
      admins: { select: { adminId: true } },
    },
  });
  return NextResponse.json({ course: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSuperuser(admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.course.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
