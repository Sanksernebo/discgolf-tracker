import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getOrCreateDeviceId } from "@/lib/device";
import { activeSinceThreshold } from "@/lib/traffic";
import { publicOriginFromRequest } from "@/lib/public-url";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/constants";

/**
 * Pick the locale to redirect a QR-scan visitor into. Order of preference:
 *   1. `NEXT_LOCALE` cookie — set by next-intl whenever the user has picked
 *      a language via LanguageSwitcher; honours their explicit choice.
 *   2. `Accept-Language` header — first tag whose base matches one of our
 *      supported locales (e.g. "en-GB" → "en").
 *   3. DEFAULT_LOCALE — the site default (Estonian).
 *
 * The QR route is excluded from the next-intl middleware by design (the
 * matcher explicitly skips `checkin`), so the redirect target must be a
 * concrete locale-prefixed URL — `/course/[id]` has no top-level file route
 * and would 404 without a prefix.
 */
async function pickLocale(req: Request): Promise<Locale> {
  const store = await cookies();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;
  if (cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  const header = req.headers.get("accept-language");
  if (header) {
    for (const part of header.split(",")) {
      const tag = part.split(";")[0]?.trim().toLowerCase();
      if (!tag) continue;
      const base = tag.split("-")[0];
      if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
    }
  }

  return DEFAULT_LOCALE;
}

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
  const locale = await pickLocale(req);

  if (!course) {
    // Unknown course id (deleted, typo in QR) — drop them at the localized
    // homepage rather than a 404.
    return NextResponse.redirect(`${origin}/${locale}`);
  }

  const deviceId = await getOrCreateDeviceId();
  const since = activeSinceThreshold();

  // Same triple-condition definition of "active" as /api/checkin and /api/ping:
  // a session past the hard `startedAt` cap must not be extended here — it
  // would leave a row that this route treats as live but that
  // getActiveCountsByCourse (which requires startedAt > since) never counts,
  // so the user would appear checked in on their own device yet not show up
  // in the map's traffic bubble.
  const existing = await prisma.checkIn.findFirst({
    where: {
      deviceId,
      courseId: course.id,
      endedAt: null,
      lastPingAt: { gt: since },
      startedAt: { gt: since },
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

  // Bake the locale into the redirect: `/course/[id]` has no top-level route
  // (only `/[locale]/course/[id]`), and this endpoint is deliberately excluded
  // from the next-intl middleware, so relying on the middleware to re-add the
  // prefix on the next hop breaks — behind Apache mod_proxy in particular the
  // second-hop rewrite has been observed to reach the app already normalized
  // and land on a nonexistent route → 404.
  return NextResponse.redirect(
    `${origin}/${locale}/course/${course.id}?checkedIn=1`,
  );
}
