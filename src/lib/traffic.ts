import { prisma } from "./prisma";
import { ACTIVE_WINDOW_MINUTES } from "./constants";

export function activeSinceThreshold(): Date {
  return new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);
}

/**
 * Player count per course, summing the party size of every active check-in
 * (rather than counting rows) so one row for a group of five contributes
 * five to the traffic total.
 */
export async function getActiveCountsByCourse(
  courseIds?: string[],
): Promise<Record<string, number>> {
  const since = activeSinceThreshold();
  const rows = await prisma.checkIn.groupBy({
    by: ["courseId"],
    where: {
      endedAt: null,
      lastPingAt: { gt: since },
      ...(courseIds ? { courseId: { in: courseIds } } : {}),
    },
    _sum: { partySize: true },
  });

  const out: Record<string, number> = {};
  if (courseIds) {
    for (const id of courseIds) out[id] = 0;
  }
  for (const r of rows) {
    out[r.courseId] = r._sum.partySize ?? 0;
  }
  return out;
}

/** Whether a given device has an active check-in on the given course. */
export async function getActiveCheckInForDevice(
  deviceId: string,
  courseId?: string,
) {
  const since = activeSinceThreshold();
  return prisma.checkIn.findFirst({
    where: {
      deviceId,
      endedAt: null,
      lastPingAt: { gt: since },
      ...(courseId ? { courseId } : {}),
    },
    orderBy: { startedAt: "desc" },
  });
}
