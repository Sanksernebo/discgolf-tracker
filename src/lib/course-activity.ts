import { prisma } from "@/lib/prisma";

const TIME_ZONE = "Europe/Tallinn";
const PERIOD_DAYS = 90;
const MIN_CHECK_INS = 20;
const HOURS_PER_BUCKET = 3;
const BUCKET_COUNT = 24 / HOURS_PER_BUCKET;

export type CourseActivityCell = {
  weekday: number; // 0 = Monday, 6 = Sunday
  bucket: number; // 0 = 00–03, 1 = 03–06, ...
  players: number;
  checkIns: number;
};

export type CourseActivityStats = {
  periodDays: number;
  totalCheckIns: number;
  totalPlayers: number;
  busiest: { weekday: number; bucket: number; players: number } | null;
  quietest: { weekday: number; bucket: number; players: number } | null;
  cells: CourseActivityCell[];
};

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "long",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

function getLocalWeekday(date: Date): number {
  return WEEKDAY_INDEX[weekdayFormatter.format(date)] ?? 0;
}

function getLocalHour(date: Date): number {
  return Number(hourFormatter.format(date));
}

export async function getCourseActivityStats(
  courseId: string,
): Promise<CourseActivityStats | null> {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - PERIOD_DAYS);

  const checkIns = await prisma.checkIn.findMany({
    where: {
      courseId,
      startedAt: { gte: from },
    },
    select: {
      startedAt: true,
      partySize: true,
    },
  });

  if (checkIns.length < MIN_CHECK_INS) {
    return null;
  }

  const cells: CourseActivityCell[] = Array.from(
    { length: 7 * BUCKET_COUNT },
    (_, index) => ({
      weekday: Math.floor(index / BUCKET_COUNT),
      bucket: index % BUCKET_COUNT,
      players: 0,
      checkIns: 0,
    }),
  );

  let totalPlayers = 0;

  for (const checkIn of checkIns) {
    const weekday = getLocalWeekday(checkIn.startedAt);
    const hour = getLocalHour(checkIn.startedAt);
    const bucket = Math.floor(hour / HOURS_PER_BUCKET);
    const cell = cells[weekday * BUCKET_COUNT + bucket];

    cell.players += checkIn.partySize;
    cell.checkIns += 1;
    totalPlayers += checkIn.partySize;
  }

  // Võrdleme ajavahemikke nende kordade arvuga perioodis.
  // Arvutame keskmise ühe nädalapäeva kohta.
  const daysPerWeekday = Array.from({ length: 7 }, (_, weekday) => {
    let count = 0;
    const cursor = new Date(from);

    while (cursor <= now) {
      if (getLocalWeekday(cursor) === weekday) {
        count += 1;
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return Math.max(count, 1);
  });

  const normalized = cells.map((cell) => ({
    ...cell,
    averagePlayers: cell.players / daysPerWeekday[cell.weekday],
  }));

  const populated = normalized.filter((cell) => cell.checkIns > 0);

  if (populated.length === 0) {
    return null;
  }

  const busiest = populated.reduce((best, cell) =>
    cell.averagePlayers > best.averagePlayers ? cell : best,
  );

  const quietest = populated.reduce((best, cell) =>
    cell.averagePlayers < best.averagePlayers ? cell : best,
  );

  return {
    periodDays: PERIOD_DAYS,
    totalCheckIns: checkIns.length,
    totalPlayers,
    busiest: {
      weekday: busiest.weekday,
      bucket: busiest.bucket,
      players: busiest.players,
    },
    quietest: {
      weekday: quietest.weekday,
      bucket: quietest.bucket,
      players: quietest.players,
    },
    cells,
  };
}
