import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDeviceId } from "@/lib/device";

export async function POST() {
  const deviceId = await getDeviceId();
  if (!deviceId) {
    return NextResponse.json({ ok: true });
  }
  await prisma.checkIn.updateMany({
    where: { deviceId, endedAt: null },
    data: { endedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
