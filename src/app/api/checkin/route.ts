import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getOrCreateDeviceId } from "@/lib/device";
import { activeSinceThreshold } from "@/lib/traffic";
import { MAX_PARTY_SIZE } from "@/lib/constants";
import { sendPushToDevice } from "@/lib/push";

const Body = z.object({
  courseId: z.string().min(1),
  // Optional: how many players this one check-in represents. Defaults to 1
  // so the plain "just me" flow stays a single argument-less button click.
  partySize: z.number().int().min(1).max(MAX_PARTY_SIZE).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { courseId, partySize } = parsed.data;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    return NextResponse.json({ error: "course_not_found" }, { status: 404 });
  }

  const deviceId = await getOrCreateDeviceId();
  const since = activeSinceThreshold();

  // If already active on this course, refresh the ping and — if the client
  // is telling us — update the party size too. Lets +/- UI operate against
  // the same endpoint with no separate PATCH.
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
      data: {
        lastPingAt: new Date(),
        ...(partySize != null ? { partySize } : {}),
      },
    });
    return NextResponse.json({ checkIn: updated });
  }

  // End any stale active check-ins for this device on any course before creating a new one.
  await prisma.checkIn.updateMany({
    where: { deviceId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const created = await prisma.checkIn.create({
    data: { courseId, deviceId, partySize: partySize ?? 1 },
  });

  // Fire-and-forget: confirm on the user's lock screen that they're marked
  // on this course. Failures here must not break the check-in itself.
  const courseName =
    (course as { nameEt?: string; nameEn?: string }).nameEt ??
    course.id;
  sendPushToDevice(deviceId, {
    title: "⛳ Discgolfi jälgija",
    body: `Registreeritud rajale: ${courseName}`,
    url: `/et/course/${course.id}`,
    tag: `checkin:${course.id}`,
  }).catch((err) => console.warn("check-in push failed:", err));

  return NextResponse.json({ checkIn: created });
}
