"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { CourseActivityStats } from "@/lib/course-activity";

type Props = {
  stats: CourseActivityStats | null;
};

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const BUCKETS = [
  { start: 0, end: 3 },
  { start: 3, end: 6 },
  { start: 6, end: 9 },
  { start: 9, end: 12 },
  { start: 12, end: 15 },
  { start: 15, end: 18 },
  { start: 18, end: 21 },
  { start: 21, end: 24 },
];

function formatTimeRange(start: number, end: number) {
  const format = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  return `${format(start)}–${format(end)}`;
}

function getIntensityClass(intensity: number) {
  if (intensity >= 0.75) {
    return "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-neutral-950";
  }

  if (intensity >= 0.45) {
    return "bg-emerald-500 text-white dark:bg-emerald-700 dark:text-white";
  }

  if (intensity >= 0.2) {
    return "bg-emerald-300 text-neutral-900 dark:bg-emerald-900 dark:text-emerald-100";
  }

  if (intensity > 0) {
    return "bg-emerald-100 text-neutral-800 dark:bg-emerald-950 dark:text-emerald-100";
  }

  return "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400";
}

export function CourseActivityStats({ stats }: Props) {
  const t = useTranslations("course.activity");
  const detailsId = useId();

  const [selectedWeekday, setSelectedWeekday] = useState(
    stats?.busiest?.weekday ?? 0,
  );
  const [showDailyActivity, setShowDailyActivity] = useState(false);

  if (!stats) {
    return (
      <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800 sm:p-5">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="mt-2 text-sm text-neutral-500">{t("notEnoughData")}</p>
      </section>
    );
  }

  const getCell = (weekday: number, bucket: number) =>
    stats.cells.find(
      (cell) => cell.weekday === weekday && cell.bucket === bucket,
    );

  const maxPlayers = Math.max(...stats.cells.map((cell) => cell.players), 1);

  const selectedDayCells = BUCKETS.map((bucket, bucketIndex) => {
    const cell = getCell(selectedWeekday, bucketIndex);
    return {
      ...bucket,
      players: cell?.players ?? 0,
      checkIns: cell?.checkIns ?? 0,
    };
  });

  const renderHighlight = (
    label: string,
    item: CourseActivityStats["busiest"],
  ) => {
    if (!item) return null;

    const bucket = BUCKETS[item.bucket];

    return (
      <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900 sm:p-4">
        <div className="text-sm text-neutral-500">{label}</div>
        <div className="mt-1 font-semibold">
          {t(`weekdays.${WEEKDAYS[item.weekday]}`)}
        </div>
        <div className="text-sm">
          {formatTimeRange(bucket.start, bucket.end)}
        </div>
      </div>
    );
  };

  return (
    <section className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800 sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-neutral-500">
          {t("description", {
            days: stats.periodDays,
            checkIns: stats.totalCheckIns,
          })}
        </p>
      </div>

      {/* Aktiivseim ja vaikseim aeg */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {renderHighlight(t("busiest"), stats.busiest)}
        {renderHighlight(t("quietest"), stats.quietest)}
      </div>

      {/* Mobiilivaade: päevade kaupa aktiivsus dropdown'is */}
      <div className="mt-5 md:hidden">
        <button
          type="button"
          aria-expanded={showDailyActivity}
          aria-controls={detailsId}
          onClick={() => setShowDailyActivity((open) => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-lg border-t border-neutral-200 py-3 text-left dark:border-neutral-800"
        >
          <span className="text-sm font-medium">{t("mobileTitle")}</span>

          <span
            aria-hidden="true"
            className={`text-lg transition-transform duration-300 ${
              showDailyActivity ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </button>

        <div
          id={detailsId}
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
            showDailyActivity ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="pb-3">
              <p className="mt-1 text-xs text-neutral-500">{t("mobileHint")}</p>

              {/* Nädalapäeva valik */}
              <div className="mt-3 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((weekday, weekdayIndex) => {
                  const isSelected = selectedWeekday === weekdayIndex;

                  return (
                    <button
                      key={weekday}
                      type="button"
                      onClick={() => setSelectedWeekday(weekdayIndex)}
                      aria-pressed={isSelected}
                      className={`min-h-10 rounded-lg px-1 text-sm font-medium transition ${
                        isSelected
                          ? "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-neutral-950"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {t(`weekdayShort.${weekday}`)}
                    </button>
                  );
                })}
              </div>

              {/* Valitud päeva ajad */}
              <div className="mt-4 space-y-3">
                {selectedDayCells.map((cell, bucketIndex) => {
                  // Võrdle aktiivsust kogu nädala maksimumiga.
                  const intensity = cell.players / maxPlayers;

                  const isPeak =
                    stats.busiest?.weekday === selectedWeekday &&
                    stats.busiest?.bucket === bucketIndex;

                  return (
                    <div key={cell.start}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                        <span className="text-neutral-600 dark:text-neutral-300">
                          {formatTimeRange(cell.start, cell.end)}
                        </span>
                        <span className="font-medium tabular-nums">
                          {cell.players > 0
                            ? t("mobilePlayers", { count: cell.players })
                            : t("noActivity")}
                          {isPeak ? ` · ${t("peakLabel")}` : ""}
                        </span>
                      </div>

                      <div
                        className="h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
                        role="img"
                        aria-label={t("cellTooltip", {
                          weekday: t(`weekdays.${WEEKDAYS[selectedWeekday]}`),
                          time: formatTimeRange(cell.start, cell.end),
                          players: cell.players,
                          checkIns: cell.checkIns,
                        })}
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${getIntensityClass(
                            intensity,
                          )}`}
                          style={{
                            width: `${
                              cell.players === 0
                                ? 0
                                : Math.max(intensity * 100, 4)
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Värvilegend */}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>{t("less")}</span>
                <span className="h-3 w-5 rounded bg-emerald-100 dark:bg-emerald-950" />
                <span className="h-3 w-5 rounded bg-emerald-300 dark:bg-emerald-900" />
                <span className="h-3 w-5 rounded bg-emerald-500 dark:bg-emerald-700" />
                <span className="h-3 w-5 rounded bg-emerald-700 dark:bg-emerald-500" />
                <span>{t("more")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop/tablet: täielik nädalapäevade heatmap */}
      <div className="mt-5 hidden md:block">
        <h3 className="mb-2 text-sm font-medium">{t("heatmapTitle")}</h3>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-20 text-left font-medium text-neutral-500">
                  {t("weekdayLabel")}
                </th>
                {BUCKETS.map((bucket) => (
                  <th
                    key={bucket.start}
                    className="px-1 py-2 text-center font-medium text-neutral-500"
                  >
                    {formatTimeRange(bucket.start, bucket.end)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((weekday, weekdayIndex) => (
                <tr key={weekday}>
                  <th className="pr-2 text-left font-medium">
                    {t(`weekdays.${weekday}`)}
                  </th>
                  {BUCKETS.map((bucket, bucketIndex) => {
                    const cell = getCell(weekdayIndex, bucketIndex);
                    const players = cell?.players ?? 0;
                    const intensity = players / maxPlayers;

                    return (
                      <td key={bucket.start}>
                        <div
                          title={t("cellTooltip", {
                            weekday: t(`weekdays.${weekday}`),
                            time: formatTimeRange(bucket.start, bucket.end),
                            players,
                            checkIns: cell?.checkIns ?? 0,
                          })}
                          className={`flex h-8 items-center justify-center rounded ${getIntensityClass(
                            intensity,
                          )}`}
                        >
                          {players || "–"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          <span>{t("less")}</span>
          <span className="h-4 w-5 rounded bg-emerald-100 dark:bg-emerald-950" />
          <span className="h-4 w-5 rounded bg-emerald-300 dark:bg-emerald-900" />
          <span className="h-4 w-5 rounded bg-emerald-500 dark:bg-emerald-700" />
          <span className="h-4 w-5 rounded bg-emerald-700 dark:bg-emerald-500" />
          <span>{t("more")}</span>
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-500">{t("disclaimer")}</p>
    </section>
  );
}
