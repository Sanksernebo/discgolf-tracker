"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type RatingValues = {
  maintenance: number;
  teeArea: number;
  experience: number;
};

type RatingData = {
  count: number;
  averages: {
    overall: number | null;
    maintenance: number | null;
    teeArea: number | null;
    experience: number | null;
  };
  myRating: RatingValues | null;
  eligibility?: {
    canRate: boolean;
    expiresAt: string | null;
  };
};

type Issue = {
  id: string;
  issueType: string | null;
  message: string;
  status: string;
  createdAt: string | Date;
};

type Props = {
  courseId: string;
  issues: Issue[];
  locale: string;
};

const ratingFields: {
  key: keyof RatingValues;
  label: string;
}[] = [
  { key: "maintenance", label: "maintenance" },
  { key: "teeArea", label: "teeArea" },
  { key: "experience", label: "experience" },
];

function Stars({
  value,
  onChange,
  disabled = false,
  starLabel,
}: {
  value: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  starLabel: (value: number) => string;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled || !onChange}
          onClick={() => onChange?.(star)}
          aria-label={starLabel(star)}
          className={`flex h-11 w-11 items-center justify-center rounded-lg text-2xl transition
            ${star <= value ? "text-emerald-400" : "text-gray-600"}
            ${
              onChange && !disabled
                ? "hover:bg-[#252525] active:scale-95"
                : "cursor-default"
            }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function CourseRatingForm({ courseId, issues, locale }: Props) {
  const t = useTranslations("course.rating");
  const tIssue = useTranslations("issue.types");

  const [data, setData] = useState<RatingData | null>(null);

  const [values, setValues] = useState<RatingValues>({
    maintenance: 0,
    teeArea: 0,
    experience: 0,
  });

  const [expanded, setExpanded] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadRating() {
      try {
        const response = await fetch(`/api/courses/${courseId}/rating`);

        if (!response.ok) {
          throw new Error();
        }

        const result: RatingData = await response.json();

        if (!cancelled) {
          setData(result);

          if (result.myRating) {
            setValues(result.myRating);
          }
        }
      } catch {
        if (!cancelled) {
          setMessage(t("error"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRating();

    return () => {
      cancelled = true;
    };
  }, [courseId, t]);

  function updateValue(key: keyof RatingValues, value: number) {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function saveRating() {
    if (values.maintenance < 1 || values.teeArea < 1 || values.experience < 1) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/courses/${courseId}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(t("error"));
      }

      const refreshResponse = await fetch(`/api/courses/${courseId}/rating`);

      if (refreshResponse.ok) {
        const refreshedData: RatingData = await refreshResponse.json();
        setData(refreshedData);
      }

      setExpanded(false);
      setMessage(t("saved"));
    } catch {
      setMessage(t("error"));
    } finally {
      setSaving(false);
    }
  }

  const issueTypeLabels: Record<string, string> = {
    broken_basket: tIssue("broken_basket"),
    course_maintenance: tIssue("course_maintenance"),
    tee_area: tIssue("tee_area"),
    signage: tIssue("signage"),
    obstacle: tIssue("obstacle"),
    litter: tIssue("litter"),
    other_course: tIssue("other_course"),
    app_bug: tIssue("app_bug"),
    other: tIssue("other"),
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-[#303030] bg-[#111111] p-4">
        <p className="text-sm text-gray-400">{t("loading")}</p>
      </div>
    );
  }

  const activeIssues = issues.filter(
    (issue) => issue.status === "open" || issue.status === "in_progress",
  );

  const visibleIssues = showAllIssues ? activeIssues : activeIssues.slice(0, 3);

  const canRate = data?.eligibility?.canRate === true;

  return (
    <section className="rounded-xl border border-[#303030] bg-[#111111] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white sm:text-lg">
            {t("title")}
          </h2>

          <p className="mt-1 text-xs text-gray-400">
            {t("activeReports", { count: activeIssues.length })}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-3xl font-bold leading-none tracking-tight text-white tabular-nums sm:text-4xl">
            {data?.averages.overall != null
              ? data.averages.overall.toFixed(1)
              : "–"}
            <span className="ml-1 text-base font-normal text-gray-400">/5</span>
          </div>

          <p className="mt-1 text-xs text-gray-400">
            {data?.count ?? 0} {t("count")}
          </p>
        </div>
      </div>

      {data?.count === 0 && (
        <p className="mt-3 text-sm text-gray-400">{t("noRatings")}</p>
      )}

      <div className="mt-5 space-y-4">
        {ratingFields.map((field) => {
          const average = data?.averages[field.key];

          return (
            <div key={field.key}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-300">{t(field.label)}</span>

                <span className="font-semibold tabular-nums text-white">
                  {average != null ? average.toFixed(1) : "–"}
                </span>
              </div>

              <div
                className="h-2 overflow-hidden rounded-full bg-[#303030]"
                role="progressbar"
                aria-label={t(field.label)}
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={average ?? 0}
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{
                    width: `${average != null ? (average / 5) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {activeIssues.length > 0 && (
        <div className="mt-5 border-t border-[#303030] pt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              {t("latestReports")}
            </h3>

            <span className="rounded-full bg-[#252525] px-2.5 py-1 text-xs text-gray-300">
              {activeIssues.length}
            </span>
          </div>

          <div className="space-y-2">
            {visibleIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg bg-[#1b1b1b] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-200">
                    {issue.issueType
                      ? (issueTypeLabels[issue.issueType] ?? t("report"))
                      : t("report")}
                  </span>

                  <span className="text-xs text-gray-500">
                    {new Date(issue.createdAt).toLocaleDateString(locale)}
                  </span>
                </div>

                <p className="mt-1 break-words text-sm text-gray-400">
                  {issue.message}
                </p>
              </div>
            ))}
          </div>

          {activeIssues.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAllIssues(!showAllIssues)}
              className="mt-3 min-h-10 text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              {showAllIssues
                ? t("showLess")
                : t("showAll", { count: activeIssues.length })}
            </button>
          )}
        </div>
      )}

      <div className="mt-5 border-t border-[#303030] pt-4">
        {canRate ? (
          <>
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
                setMessage("");
              }}
              aria-expanded={expanded}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.99]"
            >
              {expanded
                ? t("close")
                : data?.myRating
                  ? t("editRating")
                  : t("rateCourse")}
            </button>

            {expanded && (
              <div className="mt-4 space-y-4 rounded-lg bg-[#1b1b1b] p-3 sm:p-4">
                <p className="text-sm text-gray-400">
                  {t("ratingInstructions")}
                </p>

                {ratingFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <span className="text-sm font-medium text-gray-200">
                      {t(field.label)}
                    </span>

                    <Stars
                      value={values[field.key]}
                      onChange={(value) => updateValue(field.key, value)}
                      starLabel={(value) => t("starLabel", { value })}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={saveRating}
                  disabled={
                    saving ||
                    values.maintenance < 1 ||
                    values.teeArea < 1 ||
                    values.experience < 1
                  }
                  className="min-h-11 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving
                    ? t("loading")
                    : data?.myRating
                      ? t("update")
                      : t("submit")}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-[#1b1b1b] px-3 py-3 text-sm leading-relaxed text-gray-400">
            {t("checkInRequired")}
          </p>
        )}

        {message && (
          <p role="status" className="mt-3 text-center text-sm text-gray-300">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
