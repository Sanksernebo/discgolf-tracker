import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDeviceId } from "@/lib/device";
import { getCurrentAdmin, editableCourseIds } from "@/lib/admin";

const Body = z.object({
  courseId: z.string().min(1).nullable().optional(),
  category: z.enum(["course", "app", "other"]),
  message: z.string().min(3).max(2000),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { courseId, category, message } = parsed.data;
  const deviceId = await getDeviceId();

  const created = await prisma.issueReport.create({
    data: {
      courseId: courseId ?? null,
      category,
      message,
      deviceId,
    },
  });
  return NextResponse.json({ issue: created });
}

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const scope = editableCourseIds(admin);
  // Course admins only see reports on their courses; app-level (courseId=null)
  // reports remain superuser-only so nobody accidentally sees a rant that
  // wasn't scoped to them.
  const where =
    scope === null ? {} : { courseId: { in: scope } };
  const issues = await prisma.issueReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { course: { select: { nameEt: true, nameEn: true } } },
    take: 200,
  });
  return NextResponse.json({ issues });
}
