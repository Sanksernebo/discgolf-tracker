import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDeviceId } from "@/lib/device";
import { activeSinceThreshold } from "@/lib/traffic";

export async function POST() {
  const deviceId = await getDeviceId();
  if (!deviceId) {
    return NextResponse.json({ active: false });
  }
  const since = activeSinceThreshold();
  const active = await prisma.checkIn.findFirst({
    where: { deviceId, endedAt: null, lastPingAt: { gt: since } },
    orderBy: { startedAt: "desc" },
  });
  if (!active) {
    return NextResponse.json({ active: false });
  }
  const updated = await prisma.checkIn.update({
    where: { id: active.id },
    data: { lastPingAt: new Date() },
  });
  return NextResponse.json({ active: true, checkIn: updated });
}
