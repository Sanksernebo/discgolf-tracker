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
  // Same triple-condition definition of "active" as elsewhere: not ended,
  // pinged recently, AND within the total-session cap. The startedAt check
  // is what makes a phone-tab-left-open session eventually die instead of
  // living forever off its own heartbeat.
  const active = await prisma.checkIn.findFirst({
    where: {
      deviceId,
      endedAt: null,
      lastPingAt: { gt: since },
      startedAt: { gt: since },
    },
    orderBy: { startedAt: "desc" },
  });
  if (!active) {
    // Reap any session that's aged out so it doesn't sit forever with
    // endedAt=null. Silent no-op if nothing to reap.
    await prisma.checkIn.updateMany({
      where: {
        deviceId,
        endedAt: null,
        OR: [{ lastPingAt: { lte: since } }, { startedAt: { lte: since } }],
      },
      data: { endedAt: new Date() },
    });
    return NextResponse.json({ active: false });
  }
  const updated = await prisma.checkIn.update({
    where: { id: active.id },
    data: { lastPingAt: new Date() },
  });
  return NextResponse.json({ active: true, checkIn: updated });
}
