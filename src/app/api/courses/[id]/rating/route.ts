import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDeviceId, getOrCreateDeviceId } from "@/lib/device";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RatingValues = {
  maintenance: number;
  teeArea: number;
  experience: number;
};

const RATING_EDIT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function isValidRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function isValidRatingBody(body: unknown): body is RatingValues {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const ratings = body as Record<string, unknown>;

  return (
    isValidRating(ratings.maintenance) &&
    isValidRating(ratings.teeArea) &&
    isValidRating(ratings.experience)
  );
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateOverall(values: RatingValues): number {
  return roundToOneDecimal(
    (values.maintenance + values.teeArea + values.experience) / 3,
  );
}

/**
 * Seade saab hinnangut anda või muuta 3 päeva jooksul
 * pärast viimast check-in'i aktiivsuse märget.
 */
async function getRatingEligibility(courseId: string, deviceId: string | null) {
  if (!deviceId) {
    return {
      canRate: false,
      expiresAt: null as Date | null,
    };
  }

  const cutoff = new Date(Date.now() - RATING_EDIT_WINDOW_MS);

  const recentCheckIn = await prisma.checkIn.findFirst({
    where: {
      courseId,
      deviceId,
      lastPingAt: {
        gte: cutoff,
      },
    },
    orderBy: {
      lastPingAt: "desc",
    },
    select: {
      lastPingAt: true,
    },
  });

  if (!recentCheckIn) {
    return {
      canRate: false,
      expiresAt: null as Date | null,
    };
  }

  const expiresAt = new Date(
    recentCheckIn.lastPingAt.getTime() + RATING_EDIT_WINDOW_MS,
  );

  return {
    canRate: expiresAt.getTime() > Date.now(),
    expiresAt,
  };
}

// GET: raja keskmised hinnangud ja seadme enda hinnang
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id: courseId } = await params;
    const deviceId = await getDeviceId();

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [aggregate, myRating, eligibility] = await Promise.all([
      prisma.courseRating.aggregate({
        where: { courseId },
        _count: { _all: true },
        _avg: {
          maintenance: true,
          teeArea: true,
          experience: true,
        },
      }),

      deviceId
        ? prisma.courseRating.findUnique({
            where: {
              courseId_deviceId: {
                courseId,
                deviceId,
              },
            },
            select: {
              maintenance: true,
              teeArea: true,
              experience: true,
            },
          })
        : Promise.resolve(null),

      getRatingEligibility(courseId, deviceId),
    ]);

    const maintenance =
      aggregate._avg.maintenance !== null
        ? roundToOneDecimal(aggregate._avg.maintenance)
        : null;

    const teeArea =
      aggregate._avg.teeArea !== null
        ? roundToOneDecimal(aggregate._avg.teeArea)
        : null;

    const experience =
      aggregate._avg.experience !== null
        ? roundToOneDecimal(aggregate._avg.experience)
        : null;

    // Üldhinne arvutatakse kolme kategooria keskmisest.
    const overall =
      maintenance !== null && teeArea !== null && experience !== null
        ? roundToOneDecimal((maintenance + teeArea + experience) / 3)
        : null;

    return NextResponse.json({
      count: aggregate._count._all,
      averages: {
        overall,
        maintenance,
        teeArea,
        experience,
      },
      eligibility,
      myRating,
    });
  } catch (error) {
    console.error("GET course rating error:", error);

    return NextResponse.json(
      { error: "Could not load ratings" },
      { status: 500 },
    );
  }
}

// POST: loo või uuenda hinnangut
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id: courseId } = await params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!isValidRatingBody(body)) {
      return NextResponse.json(
        {
          error:
            "Maintenance, tee area and experience ratings must be integers from 1 to 5",
        },
        { status: 400 },
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Loo või loe anonüümse seadme ID küpsis.
    const deviceId = await getOrCreateDeviceId();

    // Kontrolli serveris, kas seadmel on sellel rajal hiljutine aktiivsus.
    const eligibility = await getRatingEligibility(courseId, deviceId);

    if (!eligibility.canRate) {
      return NextResponse.json(
        {
          error:
            "You must have been active on this course within the last 3 days to rate it.",
          canRate: false,
          expiresAt: eligibility.expiresAt,
        },
        { status: 403 },
      );
    }

    // Arvuta üldhinne automaatselt.
    const overall = calculateOverall(body);

    // Üks hinnang seadme ja raja kohta; olemasolevat saab uuendada.
    const rating = await prisma.courseRating.upsert({
      where: {
        courseId_deviceId: {
          courseId,
          deviceId,
        },
      },
      create: {
        courseId,
        deviceId,
        overall,
        maintenance: body.maintenance,
        teeArea: body.teeArea,
        experience: body.experience,
      },
      update: {
        overall,
        maintenance: body.maintenance,
        teeArea: body.teeArea,
        experience: body.experience,
      },
    });

    return NextResponse.json({
      success: true,
      rating: {
        overall,
        maintenance: rating.maintenance,
        teeArea: rating.teeArea,
        experience: rating.experience,
      },
    });
  } catch (error) {
    console.error("POST course rating error:", error);

    return NextResponse.json(
      { error: "Could not save rating" },
      { status: 500 },
    );
  }
}
