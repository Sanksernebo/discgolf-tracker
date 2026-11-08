"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type Issue = {
  id: string;
  courseId: string | null;
  category: string;
  issueType: string | null;
  message: string;
  status: string;
  createdAt: string;
  course: { nameEt: string; nameEn: string } | null;
};

type Status = "open" | "in_progress" | "closed";

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

export function AdminIssues({
  issues,
  onChanged,
}: {
  issues: Issue[];
  onChanged: () => void;
}) {
  const t = useTranslations("admin");

  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesStatus =
        statusFilter === "all" || issue.status === statusFilter;

      const matchesType =
        typeFilter === "all" || issue.issueType === typeFilter;

      const matchesCourse =
        courseFilter === "all" || issue.courseId === courseFilter;

      return matchesStatus && matchesType && matchesCourse;
    });
  }, [issues, statusFilter, typeFilter, courseFilter]);

  const courses = useMemo(() => {
    const map = new Map<string, string>();

    issues.forEach((issue) => {
      if (issue.courseId && issue.course) {
        map.set(issue.courseId, issue.course.nameEt);
      }
    });

    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "et"),
    );
  }, [issues]);

  async function updateStatus(issue: Issue, status: Status) {
    setSavingId(issue.id);

    try {
      const res = await fetch(`/api/admin/issues/${issue.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        onChanged();
      }
    } finally {
      setSavingId(null);
    }
  }

  function issueTypeLabel(type: string | null) {
    if (!type) return t("issueTypeUnassigned");
    return t(`issueType_${type}`);
  }

  function statusLabel(status: string) {
    if (status === "in_progress") return t("issueInProgress");
    if (status === "closed") return t("closedIssue");
    return t("openIssue");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          {t("issueFilterStatus")}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-white min-h-11"
          >
            <option value="all">{t("issueFilterAll")}</option>
            <option value="open">{t("openIssue")}</option>
            <option value="in_progress">{t("issueInProgress")}</option>
            <option value="closed">{t("closedIssue")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          {t("issueFilterType")}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-white min-h-11"
          >
            <option value="all">{t("issueFilterAll")}</option>
            {ISSUE_TYPES.map((type) => (
              <option key={type} value={type}>
                {issueTypeLabel(type)}
              </option>
            ))}
            <option value="unassigned">{t("issueTypeUnassigned")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          {t("issueFilterCourse")}
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-white min-h-11"
          >
            <option value="all">{t("analyticsAllCourses")}</option>
            {courses.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-xs text-neutral-500">
        {t("issueFilterResults", { count: filteredIssues.length })}
      </div>

      {filteredIssues.length === 0 ? (
        <div className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center">
          {t("noFilteredIssues")}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      (issue.status === "open"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : issue.status === "in_progress"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400") +
                      " px-2 py-1 rounded-full text-xs font-medium"
                    }
                  >
                    {statusLabel(issue.status)}
                  </span>

                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {issueTypeLabel(issue.issueType)}
                  </span>
                </div>

                <span className="text-xs text-neutral-500">
                  {new Date(issue.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="text-sm font-medium">
                {issue.course?.nameEt ?? t("issueNoCourse")}
              </div>

              <div className="text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {issue.message}
              </div>

              <div className="flex justify-end">
                <label className="flex items-center gap-2 text-xs text-neutral-500">
                  {t("issueChangeStatus")}
                  <select
                    value={issue.status}
                    disabled={savingId === issue.id}
                    onChange={(e) =>
                      updateStatus(issue, e.target.value as Status)
                    }
                    className="rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-2 text-sm text-neutral-900 dark:text-white disabled:opacity-50 min-h-11"
                  >
                    <option value="open">{t("openIssue")}</option>
                    <option value="in_progress">{t("issueInProgress")}</option>
                    <option value="closed">{t("closedIssue")}</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
