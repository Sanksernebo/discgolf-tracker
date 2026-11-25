import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, canEditCourse } from "@/lib/admin";

const NoticeBody = z.object({
  type: z.enum(["info", "event", "maintenance", "closed"]),
  titleEt: z.string().min(1).max(160),
  titleEn: z.string().min(1).max(160),
  messageEt: z.string().min(1),
  messageEn: z.string().min(1),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  _req: Request,
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

  const notices = await prisma.courseNotice.findMany({
    where: { courseId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ notices });
}

export async function POST(
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
  const parsed = NoticeBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const notice = await prisma.courseNotice.create({
    data: {
      ...parsed.data,
      courseId: id,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
  });

  return NextResponse.json({ notice }, { status: 201 });
}

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

  const parsed = NoticeBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const noticeId = json?.id;

  if (typeof noticeId !== "string" || !noticeId) {
    return NextResponse.json({ error: "missing_notice_id" }, { status: 400 });
  }

  const existing = await prisma.courseNotice.findFirst({
    where: { id: noticeId, courseId: id },
  });

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const notice = await prisma.courseNotice.update({
    where: { id: noticeId },
    data: {
      ...parsed.data,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    },
  });

  return NextResponse.json({ notice });
}

export async function DELETE(
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

  const { searchParams } = new URL(req.url);
  const noticeId = searchParams.get("noticeId");

  if (!noticeId) {
    return NextResponse.json({ error: "missing_notice_id" }, { status: 400 });
  }

  const existing = await prisma.courseNotice.findFirst({
    where: { id: noticeId, courseId: id },
  });

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.courseNotice.delete({
    where: { id: noticeId },
  });

  return NextResponse.json({ ok: true });
}
