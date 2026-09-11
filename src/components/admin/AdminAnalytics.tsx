"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

type Range = "day" | "week" | "month" | "year" | "all";

type CourseOption = { id: string; nameEt: string; nameEn: string };

type Summary = {
  checkIns: number;
  uniqueVisitors: number;
  players: number;
  avgPartySize: number;
  avgDurationMinutes: number;
  returningRate: number;
  activeNow: number;
};

type Analytics = {
  range: Range;
  from: string;
  to: string;
  summary: Summary;
  previousSummary: Summary | null;
  daily: {
    date: string;
    checkIns: number;
    uniqueVisitors: number;
    players: number;
  }[];
  hourly: { hour: number; checkIns: number; players: number }[];
  weekday: { weekday: number; checkIns: number; players: number }[];
  heatmap: {
    weekday: number;
    hour: number;
    checkIns: number;
    players: number;
  }[];
  courses: {
    courseId: string;
    nameEt: string;
    nameEn: string;
    checkIns: number;
    players: number;
    uniqueVisitors: number;
  }[];
};

/**
 * Analytics dashboard for course admins.
 *
 * The component owns range + course selectors and refetches on change. The
 * server enforces scope from the session — this component only decides what
 * to *ask* for, never what the admin is *allowed* to see.
 */
export function AdminAnalytics({
  courses,
  scope,
}: {
  courses: CourseOption[];
  /** Superuser gets an implicit "All courses" option; course admins do not. */
  scope: "superuser" | "courseAdmin";
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  // Superuser + no assigned filter => "All"; course admin auto-picks their
  // single course when they only have one, otherwise "All (assigned)".
  const singleCourseAdmin =
    scope === "courseAdmin" && courses.length === 1;

  const [range, setRange] = useState<Range>("month");
  const [courseId, setCourseId] = useState<string>(() =>
    singleCourseAdmin ? courses[0].id : "",
  );
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ range });
        if (courseId) params.set("courseId", courseId);
        const r = await fetch(`/api/admin/analytics?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!r.ok) throw new Error(String(r.status));
        setData((await r.json()) as Analytics);
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [range, courseId]);

  const courseName = (c: CourseOption) =>
    locale === "en" ? c.nameEn : c.nameEt;

  const ranges: Range[] = ["day", "week", "month", "year", "all"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col text-xs text-neutral-500">
          {t("analyticsRange")}
          <div className="mt-1 inline-flex rounded-full border border-neutral-300 dark:border-neutral-700 overflow-hidden">
            {ranges.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={
                  (range === r
                    ? "bg-emerald-500 text-white"
                    : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800") +
                  " px-3 py-1.5 text-sm min-h-11"
                }
              >
                {t(`analyticsRange_${r}`)}
              </button>
            ))}
          </div>
        </label>

        <label className="flex flex-col text-xs text-neutral-500">
          {t("analyticsCourse")}
          <select
            className="mt-1 h-11 rounded-full border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 text-sm"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            disabled={singleCourseAdmin}
          >
            <option value="">
              {scope === "superuser"
                ? t("analyticsAllCourses")
                : t("analyticsAllAssigned")}
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {courseName(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && !data && (
        <div className="text-sm text-neutral-500">{t("analyticsLoading")}</div>
      )}
      {error && (
        <div className="text-sm text-red-600">
          {t("analyticsError")} ({error})
        </div>
      )}

      {data && <AnalyticsBody data={data} locale={locale} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Sub-components                                */
/* -------------------------------------------------------------------------- */

function AnalyticsBody({
  data,
  locale,
}: {
  data: Analytics;
  locale: string;
}) {
  const t = useTranslations("admin");
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "et-EE", {
        month: "short",
        day: "numeric",
      }),
    [locale],
  );
  const weekdayNames = useMemo(() => {
    // Monday-first (matches our WeekdayBucket indexing).
    const base = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01 was a Monday
    const fmt = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "et-EE", {
      weekday: "short",
    });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getTime() + i * 86400000);
      return fmt.format(d);
    });
  }, [locale]);

  const returningPct = Math.round(data.summary.returningRate * 100);
  const peakHour = data.hourly.reduce(
    (best, h) => (h.checkIns > best.checkIns ? h : best),
    { hour: 0, checkIns: 0, players: 0 },
  );
  const peakWeekday = data.weekday.reduce(
    (best, w) => (w.checkIns > best.checkIns ? w : best),
    { weekday: 0, checkIns: 0, players: 0 },
  );

  const prev = data.previousSummary;
  const playersDelta = deltaPct(data.summary.players, prev?.players);
  const visitorsDelta = deltaPct(
    data.summary.uniqueVisitors,
    prev?.uniqueVisitors,
  );
  const partyDelta = deltaPct(data.summary.avgPartySize, prev?.avgPartySize);
  const activeDelta = deltaPct(data.summary.activeNow, prev?.activeNow);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label={t("analyticsPlayers")}
          value={data.summary.players.toLocaleString()}
          hint={t("analyticsCheckIns", { count: data.summary.checkIns })}
          delta={playersDelta}
        />
        <SummaryCard
          label={t("analyticsUniqueVisitors")}
          value={data.summary.uniqueVisitors.toLocaleString()}
          hint={t("analyticsReturningPct", { pct: returningPct })}
          delta={visitorsDelta}
        />
        <SummaryCard
          label={t("analyticsAvgParty")}
          value={data.summary.avgPartySize.toFixed(1)}
          hint={t("analyticsAvgDuration", {
            mins: data.summary.avgDurationMinutes,
          })}
          delta={partyDelta}
        />
        <SummaryCard
          label={t("analyticsActiveNow")}
          value={data.summary.activeNow.toLocaleString()}
          hint={
            data.summary.checkIns > 0
              ? t("analyticsPeakHour", { hour: peakHour.hour })
              : t("analyticsNoData")
          }
          delta={activeDelta}
        />
      </div>

      {data.summary.checkIns === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-sm text-neutral-500 text-center">
          {t("analyticsNoData")}
        </div>
      ) : (
        <>
          {/* Daily time series */}
          <Panel title={t("analyticsDailyTitle")}>
            <DailyChart data={data.daily} dateFmt={dateFmt} />
          </Panel>

          {/* Hour of day */}
          <Panel
            title={t("analyticsHourTitle")}
            subtitle={t("analyticsHourSubtitle", { hour: peakHour.hour })}
          >
            <HourChart data={data.hourly} />
          </Panel>

          {/* Weekday */}
          <Panel
            title={t("analyticsWeekdayTitle")}
            subtitle={t("analyticsWeekdaySubtitle", {
              weekday: weekdayNames[peakWeekday.weekday] ?? "",
            })}
          >
            <WeekdayChart data={data.weekday} labels={weekdayNames} />
          </Panel>

          {/* Weekday × hour heatmap */}
          <Panel
            title={t("analyticsHeatmapTitle")}
            subtitle={t("analyticsHeatmapSubtitle")}
          >
            <HeatmapChart data={data.heatmap} labels={weekdayNames} />
          </Panel>

          {/* Course breakdown (only useful when >1 course in scope) */}
          {data.courses.length > 1 && (
            <Panel title={t("analyticsCourseBreakdown")}>
              <CourseTable
                rows={data.courses}
                locale={locale}
                labels={{
                  course: t("analyticsColCourse"),
                  players: t("analyticsColPlayers"),
                  checkIns: t("analyticsColCheckIns"),
                  unique: t("analyticsColUnique"),
                }}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Signed percentage change vs. the previous period. `null` means "no
 * comparable baseline" — either no previous data was fetched, or the
 * previous window was zero and dividing would yield ±Infinity/NaN.
 */
type Delta = { pct: number; direction: "up" | "down" | "flat" } | null;

function deltaPct(current: number, previous: number | undefined): Delta {
  if (previous == null) return null;
  // Zero-baseline case: don't render "∞%" but do surface that the metric
  // moved off zero as an "up" flat-100 (arbitrary but readable) — omit
  // entirely when both sides are zero.
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "flat" };
    return { pct: 100, direction: "up" };
  }
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw);
  return {
    pct: Math.abs(rounded),
    direction: rounded > 0 ? "up" : rounded < 0 ? "down" : "flat",
  };
}

function DeltaChip({ delta }: { delta: Delta }) {
  const t = useTranslations("admin");
  if (!delta) return null;
  const color =
    delta.direction === "up"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : delta.direction === "down"
        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  const arrow =
    delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "•";
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${color}`}
      title={t("analyticsVsPrevious")}
    >
      <span aria-hidden>{arrow}</span>
      <span className="tabular-nums">{delta.pct}%</span>
    </span>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: Delta;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {delta && <DeltaChip delta={delta} />}
      </div>
      {hint && (
        <div className="mt-1 text-xs text-neutral-500 truncate">{hint}</div>
      )}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3">
      <header className="mb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && (
          <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
        )}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Charts                                   */
/* -------------------------------------------------------------------------- */

function DailyChart({
  data,
  dateFmt,
}: {
  data: Analytics["daily"];
  dateFmt: Intl.DateTimeFormat;
}) {
  const width = Math.max(320, data.length * 22);
  const height = 200;
  const pad = { top: 12, right: 12, bottom: 28, left: 32 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.players));
  const xStep = data.length > 1 ? w / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + h - (d.players / max) * h;
    return { x, y, d };
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${
          pad.top + h
        } L ${points[0].x} ${pad.top + h} Z`
      : "";

  // Show at most ~6 date labels along the axis so they don't overlap.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Daily traffic"
      className="max-w-full"
    >
      {/* Y-axis gridlines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.left}
          x2={pad.left + w}
          y1={pad.top + h - h * f}
          y2={pad.top + h - h * f}
          stroke="currentColor"
          strokeOpacity={0.08}
        />
      ))}
      {/* Area + line */}
      <path d={areaPath} fill="rgb(16 185 129)" fillOpacity={0.15} />
      <path
        d={linePath}
        fill="none"
        stroke="rgb(16 185 129)"
        strokeWidth={2}
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgb(16 185 129)">
          <title>
            {p.d.date}: {p.d.players} players ({p.d.checkIns} check-ins)
          </title>
        </circle>
      ))}
      {/* X-axis labels */}
      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text
            key={`lbl-${i}`}
            x={p.x}
            y={height - 10}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.6}
          >
            {dateFmt.format(new Date(`${p.d.date}T12:00:00Z`))}
          </text>
        ) : null,
      )}
      {/* Y-axis max label */}
      <text
        x={pad.left - 6}
        y={pad.top + 4}
        textAnchor="end"
        fontSize={10}
        fill="currentColor"
        fillOpacity={0.6}
      >
        {max}
      </text>
      <text
        x={pad.left - 6}
        y={pad.top + h}
        textAnchor="end"
        fontSize={10}
        fill="currentColor"
        fillOpacity={0.6}
      >
        0
      </text>
    </svg>
  );
}

function HourChart({ data }: { data: Analytics["hourly"] }) {
  const width = 24 * 22;
  const height = 180;
  const pad = { top: 12, right: 8, bottom: 24, left: 24 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.players));
  const barW = w / 24 - 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Hour of day"
      className="max-w-full"
    >
      {data.map((d) => {
        const barH = (d.players / max) * h;
        const x = pad.left + (w / 24) * d.hour + 1;
        const y = pad.top + h - barH;
        return (
          <g key={d.hour}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={2}
              fill="rgb(16 185 129)"
              fillOpacity={d.players === 0 ? 0.15 : 0.85}
            >
              <title>
                {d.hour.toString().padStart(2, "0")}:00 — {d.players} players
              </title>
            </rect>
            {d.hour % 3 === 0 && (
              <text
                x={x + barW / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                fillOpacity={0.6}
              >
                {d.hour}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function WeekdayChart({
  data,
  labels,
}: {
  data: Analytics["weekday"];
  labels: string[];
}) {
  const width = 7 * 44;
  const height = 180;
  const pad = { top: 12, right: 8, bottom: 24, left: 24 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.players));
  const slot = w / 7;
  const barW = slot - 12;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Day of week"
      className="max-w-full"
    >
      {data.map((d) => {
        const barH = (d.players / max) * h;
        const x = pad.left + slot * d.weekday + (slot - barW) / 2;
        const y = pad.top + h - barH;
        return (
          <g key={d.weekday}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill="rgb(16 185 129)"
              fillOpacity={d.players === 0 ? 0.15 : 0.85}
            >
              <title>
                {labels[d.weekday]} — {d.players} players
              </title>
            </rect>
            <text
              x={pad.left + slot * d.weekday + slot / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              fillOpacity={0.6}
            >
              {labels[d.weekday]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HeatmapChart({
  data,
  labels,
}: {
  data: Analytics["heatmap"];
  labels: string[];
}) {
  // Grid geometry: y-axis reserves room for weekday labels, x-axis for
  // an hour scale under each column.
  const cellW = 22;
  const cellH = 22;
  const padLeft = 44;
  const padTop = 4;
  const padBottom = 20;
  const width = padLeft + cellW * 24 + 8;
  const height = padTop + cellH * 7 + padBottom;

  const max = Math.max(1, ...data.map((c) => c.players));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Weekday × hour utilization"
      className="max-w-full"
    >
      {/* Weekday row labels */}
      {labels.map((name, w) => (
        <text
          key={`row-${w}`}
          x={padLeft - 6}
          y={padTop + cellH * w + cellH * 0.66}
          textAnchor="end"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.6}
        >
          {name}
        </text>
      ))}
      {/* Hour column labels (every 3 hours) */}
      {Array.from({ length: 24 }, (_, h) =>
        h % 3 === 0 ? (
          <text
            key={`col-${h}`}
            x={padLeft + cellW * h + cellW / 2}
            y={height - 6}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.6}
          >
            {h}
          </text>
        ) : null,
      )}
      {/* Cells */}
      {data.map((cell) => {
        // Non-linear intensity so a single popular slot doesn't wash the
        // whole grid to nothing. sqrt gives a friendlier ramp on skewed data.
        const intensity =
          cell.players === 0 ? 0 : Math.sqrt(cell.players / max);
        const x = padLeft + cell.hour * cellW;
        const y = padTop + cell.weekday * cellH;
        // Use the same emerald hue but modulate opacity; the empty cell keeps
        // a faint tint so the grid stays legible.
        const opacity = cell.players === 0 ? 0.08 : 0.15 + intensity * 0.75;
        return (
          <rect
            key={`${cell.weekday}-${cell.hour}`}
            x={x + 1}
            y={y + 1}
            width={cellW - 2}
            height={cellH - 2}
            rx={3}
            fill="rgb(16 185 129)"
            fillOpacity={opacity}
          >
            <title>
              {labels[cell.weekday]} {cell.hour.toString().padStart(2, "0")}:00
              {" "}— {cell.players} players ({cell.checkIns} check-ins)
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function CourseTable({
  rows,
  locale,
  labels,
}: {
  rows: Analytics["courses"];
  locale: string;
  labels: {
    course: string;
    players: string;
    checkIns: string;
    unique: string;
  };
}) {
  const max = Math.max(1, ...rows.map((r) => r.players));
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-neutral-500">
          <th className="py-1.5">{labels.course}</th>
          <th className="py-1.5 text-right">{labels.players}</th>
          <th className="py-1.5 text-right">{labels.checkIns}</th>
          <th className="py-1.5 text-right">{labels.unique}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const pct = (r.players / max) * 100;
          return (
            <tr
              key={r.courseId}
              className="border-t border-neutral-200 dark:border-neutral-800"
            >
              <td className="py-1.5">
                <div>{locale === "en" ? r.nameEn : r.nameEt}</div>
                <div className="mt-1 h-1 rounded bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </td>
              <td className="py-1.5 text-right tabular-nums font-medium">
                {r.players.toLocaleString()}
              </td>
              <td className="py-1.5 text-right tabular-nums text-neutral-500">
                {r.checkIns.toLocaleString()}
              </td>
              <td className="py-1.5 text-right tabular-nums text-neutral-500">
                {r.uniqueVisitors.toLocaleString()}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
