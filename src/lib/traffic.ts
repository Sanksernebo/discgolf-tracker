import { prisma } from "./prisma";
import { ACTIVE_WINDOW_MINUTES } from "./constants";

export function activeSinceThreshold(): Date {
  return new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);
}

/**
 * A check-in counts as "active" when ALL of these hold:
 *   - endedAt IS NULL (not explicitly checked out)
 *   - lastPingAt > now - ACTIVE_WINDOW_MINUTES (still pinging)
 *   - startedAt > now - ACTIVE_WINDOW_MINUTES (hasn't outlived the hard cap)
 *
 * The hard cap on `startedAt` is what enforces the "3 hours after check-in
 * you're done" contract even on phones that keep the tab alive in the
 * background and never stop pinging.
 */
function activeWhere(extra?: object) {
  const since = activeSinceThreshold();
  return {
    endedAt: null,
    lastPingAt: { gt: since },
    startedAt: { gt: since },
    ...extra,
  };
}

/**
 * Player count per course, summing the party size of every active check-in
 * (rather than counting rows) so one row for a group of five contributes
 * five to the traffic total.
 */
export async function getActiveCountsByCourse(
  courseIds?: string[],
): Promise<Record<string, number>> {
  const rows = await prisma.checkIn.groupBy({
    by: ["courseId"],
    where: activeWhere(
      courseIds ? { courseId: { in: courseIds } } : undefined,
    ),
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
  return prisma.checkIn.findFirst({
    where: activeWhere({ deviceId, ...(courseId ? { courseId } : {}) }),
    orderBy: { startedAt: "desc" },
  });
}
