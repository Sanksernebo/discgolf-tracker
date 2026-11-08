import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  getActiveCountsByCourse,
  getActiveCheckInForDevice,
} from "@/lib/traffic";
import { getDeviceId } from "@/lib/device";
import { fetchCurrentWeather, weatherEmoji } from "@/lib/weather";
import { ESTONIAN_COUNTIES } from "@/lib/constants";
import { CheckInPanel } from "@/components/course/CheckInPanel";
import { ReportIssueButton } from "@/components/course/ReportIssueButton";
import { CourseMiniMap } from "@/components/map/CourseMiniMap";
import { Link } from "@/i18n/navigation";
import { CourseActivityStats } from "@/components/course/CourseActivityStats";
import { getCourseActivityStats } from "@/lib/course-activity";
import CourseRatingForm from "@/components/course/CourseRatingForm";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const course = await prisma.course.findUnique({
    where: { id },
    include: { holes: { orderBy: { number: "asc" } } },
  });

  if (!course) notFound();

  const [counts, weather, deviceId, activityStats, activeIssues] =
    await Promise.all([
      getActiveCountsByCourse([course.id]),
      fetchCurrentWeather(course.latitude, course.longitude),
      getDeviceId(),
      getCourseActivityStats(course.id),
      prisma.issueReport.findMany({
        where: {
          courseId: course.id,
          status: { in: ["open", "in_progress"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          issueType: true,
          message: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

  const active = deviceId
    ? await getActiveCheckInForDevice(deviceId, course.id)
    : null;

  const activeCount = counts[course.id] ?? 0;
  const name = locale === "en" ? course.nameEn : course.nameEt;
  const description =
    locale === "en" ? course.descriptionEn : course.descriptionEt;

  const countyLabel =
    ESTONIAN_COUNTIES[course.county]?.[locale === "en" ? "en" : "et"] ??
    course.county;

  const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);

  const isEnglish = locale === "en";

  const pageText = {
    players: isEnglish ? "Players on course" : "Mängijaid rajal",
    noPlayers: isEnglish ? "No active players" : "Hetkel pole mängijaid",
    playersNow: isEnglish ? "Currently playing" : "Hetkel mängimas",
    holes: isEnglish ? "Holes" : "Korvid",
    totalPar: isEnglish ? "Total par" : "Raja par",
    weather: isEnglish ? "Weather" : "Ilm rajal",
    wind: isEnglish ? "Wind" : "Tuul",
    precipitation: isEnglish ? "Precipitation" : "Sademed",
    hole: isEnglish ? "Hole" : "Korv",
    par: "Par",
    distance: isEnglish ? "Distance" : "Kaugus",
    courseDetails: isEnglish ? "Course details" : "Raja info",
    meters: isEnglish ? "m" : "m",
    coursePhoto: isEnglish ? "Course overview" : "Raja üldpilt",
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:gap-8 sm:py-8">
      {/* Tagasi ja raja päis */}
      <header className="space-y-4">
        <Link
          href={{ pathname: "/", query: { county: course.county } }}
          className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full text-sm font-medium text-emerald-700 transition hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
        >
          <span aria-hidden="true">←</span>
          {t("course.backToCountyMap", { county: countyLabel })}
        </Link>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            <span>{countyLabel}</span>
            {course.city && (
              <>
                <span aria-hidden="true">·</span>
                <span>{course.city}</span>
              </>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {name}
          </h1>

          {description && (
            <p className="max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-300 sm:text-base">
              {description}
            </p>
          )}
        </div>

        {course.imageUrl && (
          <div className="relative mt-5 overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-100 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <img
              src={course.imageUrl}
              alt={`${name} – ${pageText.coursePhoto}`}
              className="max-h-[420px] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-12 sm:px-6 sm:pb-5">
              <p className="text-sm font-semibold text-white">
                {pageText.coursePhoto}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Kiirstatistika */}
      <section
        aria-label={pageText.courseDetails}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        <div className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl">
            🥏
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {pageText.players}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {activeCount}
            </p>
            <p className="text-xs text-neutral-500">
              {activeCount === 0 ? pageText.noPlayers : pageText.playersNow}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-2xl">
            🏁
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {pageText.holes}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {course.holes.length}
            </p>
            <p className="text-xs text-neutral-500">
              {pageText.totalPar}: {totalPar}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-2xl">
            {weather ? weatherEmoji(weather.weatherCode) : "🌤️"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {pageText.weather}
            </p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums">
              {weather?.temperatureC != null
                ? `${Math.round(weather.temperatureC)}°C`
                : "—"}
            </p>
            <p className="text-xs text-neutral-500">
              {pageText.wind}:{" "}
              {weather?.windSpeedKmh != null
                ? `${Math.round(weather.windSpeedKmh)} km/h`
                : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* Check-in */}
      <CheckInPanel
        courseId={course.id}
        initialCheckIn={
          active
            ? {
                id: active.id,
                startedAt: active.startedAt.toISOString(),
                lastPingAt: active.lastPingAt.toISOString(),
                partySize: active.partySize,
              }
            : null
        }
      />

      {/* Raja seisukord */}
      <CourseActivityStats stats={activityStats} />

      <CourseRatingForm
        courseId={course.id}
        issues={activeIssues}
        locale={locale}
      />

      {/* Raja augud ja kaart */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 lg:col-span-2">
          <div className="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800 sm:px-6">
            <h2 className="text-lg font-bold">{t("course.holes")}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {course.holes.length} {pageText.holes.toLowerCase()} ·{" "}
              {pageText.totalPar}: {totalPar}
            </p>
          </div>

          {/* Mobiilivaade: augud kaartidena */}
          <div className="grid grid-cols-2 gap-3 p-4 sm:hidden">
            {course.holes.map((h) => (
              <div
                key={h.id}
                className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-950"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-500">
                    {pageText.hole}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {h.number}
                  </span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-neutral-500">{pageText.par}</p>
                    <p className="text-xl font-bold">{h.par}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-500">
                      {pageText.distance}
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {h.distance != null
                        ? `${h.distance} ${pageText.meters}`
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Suurem ekraan: tabel */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="px-6 py-3">{pageText.hole}</th>
                  <th className="px-6 py-3">{pageText.par}</th>
                  <th className="px-6 py-3">{pageText.distance}</th>
                </tr>
              </thead>
              <tbody>
                {course.holes.map((h) => (
                  <tr
                    key={h.id}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-6 py-3 font-semibold">{h.number}</td>
                    <td className="px-6 py-3">{h.par}</td>
                    <td className="px-6 py-3 text-neutral-500">
                      {h.distance != null
                        ? `${h.distance} ${pageText.meters}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div>
            <h2 className="mb-3 text-lg font-bold">
              {isEnglish ? "Course location" : "Raja asukoht"}
            </h2>
            <CourseMiniMap
              lat={course.latitude}
              lng={course.longitude}
              name={name}
            />
          </div>

          <div className="border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <ReportIssueButton courseId={course.id} />
          </div>

          {weather && (
            <div className="rounded-2xl bg-sky-50 p-4 dark:bg-sky-950/30">
              <p className="text-sm font-semibold">{pageText.weather}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                <span>
                  💨 {pageText.wind}:{" "}
                  {weather.windSpeedKmh != null
                    ? `${Math.round(weather.windSpeedKmh)} km/h`
                    : "—"}
                </span>
                <span>
                  🌧️ {pageText.precipitation}:{" "}
                  {weather.precipitationMm != null
                    ? `${weather.precipitationMm} mm`
                    : "—"}
                </span>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
