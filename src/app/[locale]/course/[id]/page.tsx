import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getActiveCountsByCourse, getActiveCheckInForDevice } from "@/lib/traffic";
import { getDeviceId } from "@/lib/device";
import { fetchCurrentWeather, weatherEmoji } from "@/lib/weather";
import { ESTONIAN_COUNTIES } from "@/lib/constants";
import { CheckInPanel } from "@/components/course/CheckInPanel";
import { ReportIssueButton } from "@/components/course/ReportIssueButton";
import { CourseMiniMap } from "@/components/map/CourseMiniMap";
import { Link } from "@/i18n/navigation";

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

  const [counts, weather, deviceId] = await Promise.all([
    getActiveCountsByCourse([course.id]),
    fetchCurrentWeather(course.latitude, course.longitude),
    getDeviceId(),
  ]);

  const active = deviceId
    ? await getActiveCheckInForDevice(deviceId, course.id)
    : null;

  const activeCount = counts[course.id] ?? 0;
  const name = locale === "en" ? course.nameEn : course.nameEt;
  const description = locale === "en" ? course.descriptionEn : course.descriptionEt;
  const countyLabel =
    ESTONIAN_COUNTIES[course.county]?.[locale === "en" ? "en" : "et"] ??
    course.county;
  const totalPar = course.holes.reduce((sum, h) => sum + h.par, 0);

  return (
    <div className="max-w-6xl mx-auto w-full px-4 py-6 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={{ pathname: "/", query: { county: course.county } }}
          className="text-sm text-emerald-700 dark:text-emerald-400 hover:underline focus:outline-none w-fit inline-flex items-center gap-1"
        >
          <span aria-hidden>←</span>
          {t("course.backToCountyMap", { county: countyLabel })}
        </Link>
        <div className="text-xs uppercase tracking-wide text-neutral-500">
          {countyLabel}
          {course.city ? ` · ${course.city}` : ""}
        </div>
        <h1 className="text-3xl font-semibold">{name}</h1>
        {description && (
          <p className="text-neutral-600 dark:text-neutral-300 max-w-2xl">
            {description}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-1">
          <div className="text-xs uppercase text-neutral-500">
            {t("course.traffic")}
          </div>
          <div className="text-3xl font-semibold">
            {activeCount}
          </div>
          <div className="text-sm text-neutral-500">
            {activeCount === 0
              ? t("course.noPlayers")
              : t("course.playersNow")}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-1">
          <div className="text-xs uppercase text-neutral-500">
            {t("course.holes")}
          </div>
          <div className="text-3xl font-semibold">{course.holes.length}</div>
          <div className="text-sm text-neutral-500">
            {t("course.totalPar")}: {totalPar}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-1">
          <div className="text-xs uppercase text-neutral-500">
            {t("course.weather")}
          </div>
          {weather ? (
            <>
              <div className="text-3xl font-semibold flex items-center gap-2">
                <span>{weatherEmoji(weather.weatherCode)}</span>
                <span>
                  {weather.temperatureC != null
                    ? `${Math.round(weather.temperatureC)}°C`
                    : "—"}
                </span>
              </div>
              <div className="text-sm text-neutral-500">
                {t("course.windSpeed")}:{" "}
                {weather.windSpeedKmh != null
                  ? `${Math.round(weather.windSpeedKmh)} km/h`
                  : "—"}
                {" · "}
                {t("course.precipitation")}:{" "}
                {weather.precipitationMm != null
                  ? `${weather.precipitationMm} mm`
                  : "—"}
              </div>
            </>
          ) : (
            <div className="text-sm text-neutral-500">—</div>
          )}
        </div>
      </div>

      <CheckInPanel
        courseId={course.id}
        initialCheckIn={
          active
            ? {
                id: active.id,
                startedAt: active.startedAt.toISOString(),
                lastPingAt: active.lastPingAt.toISOString(),
              }
            : null
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4">
          <h2 className="text-lg font-semibold mb-3">{t("course.holes")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-neutral-500">
                <tr>
                  <th className="text-left py-2 pr-4">{t("course.hole")}</th>
                  <th className="text-left py-2 pr-4">{t("course.par")}</th>
                  <th className="text-left py-2">{t("course.distance")}</th>
                </tr>
              </thead>
              <tbody>
                {course.holes.map((h) => (
                  <tr
                    key={h.id}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="py-2 pr-4 font-medium">{h.number}</td>
                    <td className="py-2 pr-4">{h.par}</td>
                    <td className="py-2 text-neutral-500">
                      {h.distance != null ? `${h.distance} m` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3">
          <CourseMiniMap lat={course.latitude} lng={course.longitude} name={name} />
          <ReportIssueButton courseId={course.id} />
        </div>
      </div>
    </div>
  );
}
