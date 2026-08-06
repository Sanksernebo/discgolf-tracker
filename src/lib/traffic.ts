import { prisma } from "./prisma";
import { ACTIVE_WINDOW_MINUTES } from "./constants";

export function activeSinceThreshold(): Date {
  return new Date(Date.now() - ACTIVE_WINDOW_MINUTES * 60 * 1000);
}

/** Count of active players per course (any course id given, plus zero-fill for others). */
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
    _count: { _all: true },
  });

  const out: Record<string, number> = {};
  if (courseIds) {
    for (const id of courseIds) out[id] = 0;
  }
  for (const r of rows) {
    out[r.courseId] = r._count._all;
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
