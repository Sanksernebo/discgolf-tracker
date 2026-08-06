import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateDeviceId } from "@/lib/device";
import { activeSinceThreshold } from "@/lib/traffic";

const Body = z.object({
  courseId: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { courseId } = parsed.data;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const deviceId = await getOrCreateDeviceId();
  const since = activeSinceThreshold();

  // If already active on this course, just refresh the ping.
  const existing = await prisma.checkIn.findFirst({
    where: {
      deviceId,
      courseId,
      endedAt: null,
      lastPingAt: { gt: since },
    },
  });

  if (existing) {
    const updated = await prisma.checkIn.update({
      where: { id: existing.id },
      data: { lastPingAt: new Date() },
    });
    return NextResponse.json({ checkIn: updated });
  }

  // End any stale active check-ins for this device on any course before creating a new one.
  await prisma.checkIn.updateMany({
    where: { deviceId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const created = await prisma.checkIn.create({
    data: { courseId, deviceId },
  });
  return NextResponse.json({ checkIn: created });
}
