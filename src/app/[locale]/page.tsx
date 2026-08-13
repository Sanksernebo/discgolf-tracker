import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveCountsByCourse } from "@/lib/traffic";
import { EstoniaMap } from "@/components/map/EstoniaMap";
import { ActiveCheckInBanner } from "@/components/ActiveCheckInBanner";
import { ESTONIAN_COUNTIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const courses = await prisma.course.findMany({
    orderBy: { nameEt: "asc" },
    select: {
      id: true,
      nameEt: true,
      nameEn: true,
      county: true,
      city: true,
      latitude: true,
      longitude: true,
      _count: { select: { holes: true } },
    },
  });

  const counts = await getActiveCountsByCourse(courses.map((c) => c.id));

  const coursesForMap = courses.map((c) => ({
    id: c.id,
    name: locale === "en" ? c.nameEn : c.nameEt,
    county: c.county,
    countyLabel:
      ESTONIAN_COUNTIES[c.county]?.[locale === "en" ? "en" : "et"] ?? c.county,
    city: c.city,
    lat: c.latitude,
    lng: c.longitude,
    holeCount: c._count.holes,
    activeCount: counts[c.id] ?? 0,
  }));

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-4 flex-1">
      <div>
        <h1 className="text-2xl font-semibold">{t("app.title")}</h1>
        <p className="text-sm text-neutral-500">{t("app.tagline")}</p>
      </div>
      <ActiveCheckInBanner locale={locale} />
      <EstoniaMap courses={coursesForMap} locale={locale} />
    </div>
  );
}
