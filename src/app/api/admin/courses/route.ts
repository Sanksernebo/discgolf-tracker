import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  isSuperuser,
  editableCourseIds,
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
  // Superuser-only when creating: initial course-admin assignments.
  assignedAdminIds: z.array(z.string()).optional(),
});

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scope = editableCourseIds(admin);
  const courses = await prisma.course.findMany({
    where: scope === null ? {} : { id: { in: scope } },
    orderBy: { nameEt: "asc" },
    include: {
      holes: { orderBy: { number: "asc" } },
      admins: { select: { adminId: true } },
    },
  });
  return NextResponse.json({ courses });
}

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isSuperuser(admin)) {
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
  const created = await prisma.course.create({
    data: {
      ...data,
      holes: { create: holes.map((h) => ({ ...h, distance: h.distance ?? null })) },
      admins: assignedAdminIds?.length
        ? { create: assignedAdminIds.map((adminId) => ({ adminId })) }
        : undefined,
    },
    include: {
      holes: { orderBy: { number: "asc" } },
      admins: { select: { adminId: true } },
    },
  });
  return NextResponse.json({ course: created });
}
