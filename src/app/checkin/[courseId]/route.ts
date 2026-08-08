import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateDeviceId } from "@/lib/device";
import { activeSinceThreshold } from "@/lib/traffic";
import { publicOriginFromRequest } from "@/lib/public-url";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> },
) {
  const { courseId } = await params;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true },
  });

  const origin = publicOriginFromRequest(req);

  if (!course) {
    return NextResponse.redirect(`${origin}/`);
  }

  const deviceId = await getOrCreateDeviceId();
  const since = activeSinceThreshold();

  const existing = await prisma.checkIn.findFirst({
    where: {
      deviceId,
      courseId: course.id,
      endedAt: null,
      lastPingAt: { gt: since },
    },
  });

  if (existing) {
    await prisma.checkIn.update({
      where: { id: existing.id },
      data: { lastPingAt: new Date() },
    });
  } else {
    await prisma.checkIn.updateMany({
      where: { deviceId, endedAt: null },
      data: { endedAt: new Date() },
    });
    await prisma.checkIn.create({
      data: { courseId: course.id, deviceId },
    });
  }

  // Locale prefix is optional — the middleware will re-detect the user's locale
  // on the redirected URL.
  return NextResponse.redirect(`${origin}/course/${course.id}?checkedIn=1`);
}
