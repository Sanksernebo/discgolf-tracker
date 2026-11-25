type Issue = {
  id: string;
  issueType: string | null;
  message: string;
  status: string;
  createdAt: Date;
};

type Props = {
  issues: Issue[];
  locale: string;
};

const ISSUE_TYPES = [
  "broken_basket",
  "course_maintenance",
  "tee_area",
  "signage",
  "obstacle",
  "litter",
  "other_course",
  "app_bug",
  "other",
] as const;

const ISSUE_LABELS: Record<string, { et: string; en: string }> = {
  broken_basket: { et: "Korv katki", en: "Broken basket" },
  course_maintenance: { et: "Rada hooldamata", en: "Course maintenance" },
  tee_area: { et: "Tiiala probleem", en: "Tee area problem" },
  signage: { et: "Silt või infotahvel katki", en: "Broken sign / board" },
  obstacle: { et: "Takistus rajal", en: "Obstacle on course" },
  litter: { et: "Prügi või prügikast", en: "Litter / bin" },
  other_course: { et: "Muu rajaprobleem", en: "Other course issue" },
  app_bug: { et: "Rakenduse viga", en: "App bug" },
  other: { et: "Muu probleem", en: "Other issue" },
};

export function CourseConditionOverview({ issues, locale }: Props) {
  const isEnglish = locale === "en";

  const text = {
    title: isEnglish ? "Course condition" : "Raja seisukord",
    good: isEnglish ? "No open issues reported" : "Avatud probleeme pole teada",
    attention: isEnglish ? "Needs attention" : "Vajab tähelepanu",
    activeIssues: isEnglish ? "Active issues" : "Lahendamata probleemid",
    latest: isEnglish ? "Latest reports" : "Viimased teated",
    noIssues: isEnglish
      ? "No unresolved issues have been reported for this course."
      : "Selle raja kohta pole lahendamata probleeme teatatud.",
    open: isEnglish ? "Open" : "Avatud",
    inProgress: isEnglish ? "In progress" : "Töös",
    issueTypes: isEnglish ? "Issue categories" : "Probleemide kategooriad",
    reports: isEnglish ? "reports" : "teadet",
  };

  const counts = new Map<string, number>();

  for (const issue of issues) {
    const type = issue.issueType ?? "other";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  const latestIssues = issues.slice(0, 3);
  const hasIssues = issues.length > 0;

  function getIssueLabel(type: string | null) {
    const labels = ISSUE_LABELS[type ?? "other"] ?? ISSUE_LABELS.other;
    return isEnglish ? labels.en : labels.et;
  }

  return (
    <section
      aria-labelledby="course-condition-title"
      className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-xl">
              🌿
            </div>

            <div className="min-w-0">
              <h2
                id="course-condition-title"
                className="text-lg font-bold tracking-tight"
              >
                {text.title}
              </h2>
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {hasIssues ? text.attention : text.good}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              hasIssues
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
          >
            {issues.length} {text.activeIssues.toLowerCase()}
          </span>
        </div>

        <div
          className={`rounded-2xl p-4 ${
            hasIssues
              ? "bg-amber-50 dark:bg-amber-950/30"
              : "bg-emerald-50 dark:bg-emerald-950/30"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">
              {hasIssues ? "⚠️" : "✓"}
            </span>
            <div>
              <p
                className={`text-sm font-semibold ${
                  hasIssues
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-emerald-900 dark:text-emerald-200"
                }`}
              >
                {hasIssues ? text.attention : text.good}
              </p>
              <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {hasIssues
                  ? `${issues.length} ${text.activeIssues.toLowerCase()}`
                  : text.noIssues}
              </p>
            </div>
          </div>
        </div>

        {hasIssues && (
          <>
            <div>
              <h3 className="mb-3 text-sm font-semibold">{text.issueTypes}</h3>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ISSUE_TYPES.filter((type) => counts.has(type)).map((type) => (
                  <div
                    key={type}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <span className="min-w-0 text-sm">
                      {getIssueLabel(type)}
                    </span>
                    <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-bold tabular-nums dark:bg-neutral-800">
                      {counts.get(type)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-semibold">{text.latest}</h3>

              <ul className="space-y-3">
                {latestIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <span className="text-sm font-semibold">
                        {getIssueLabel(issue.issueType)}
                      </span>

                      <span
                        className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${
                          issue.status === "in_progress"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                      >
                        {issue.status === "in_progress"
                          ? text.inProgress
                          : text.open}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
                      {issue.message}
                    </p>

                    <p className="mt-3 text-xs text-neutral-400">
                      {new Date(issue.createdAt).toLocaleDateString(
                        isEnglish ? "en-GB" : "et-EE",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
