"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { CourseEditor, type CourseWithHoles } from "./CourseEditor";
import { CourseQr } from "./CourseQr";
import { AdminUsers } from "./AdminUsers";
import { AdminAnalytics } from "./AdminAnalytics";
import { AdminIssues } from "./AdminIssues";
import { ESTONIAN_COUNTIES } from "@/lib/constants";

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

type Me = {
  id: string;
  email: string;
  name: string | null;
  role: "superuser" | "courseAdmin";
  courseIds: string[];
};

type Tab = "courses" | "analytics" | "issues" | "users";

export function AdminDashboard() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>("courses");
  const [courses, setCourses] = useState<CourseWithHoles[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [editing, setEditing] = useState<CourseWithHoles | "new" | null>(null);
  const [qrFor, setQrFor] = useState<CourseWithHoles | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    const res = await fetch("/api/admin/me");
    if (res.ok) {
      const data = (await res.json()) as { admin: Me | null };
      setMe(data.admin);
    }
  }
  async function loadCourses() {
    const res = await fetch("/api/admin/courses");
    if (res.ok) {
      const data = (await res.json()) as { courses: CourseWithHoles[] };
      setCourses(data.courses);
    }
  }
  async function loadIssues() {
    const res = await fetch("/api/issues");
    if (res.ok) {
      const data = (await res.json()) as { issues: Issue[] };
      setIssues(data.issues);
    }
  }

  useEffect(() => {
    Promise.all([loadMe(), loadCourses(), loadIssues()]).finally(() =>
      setLoading(false),
    );
  }, []);

  const isSuperuser = me?.role === "superuser";

  async function deleteCourse(c: CourseWithHoles) {
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/admin/courses/${c.id}`, { method: "DELETE" });
    if (res.ok) loadCourses();
  }

  async function toggleIssue(i: Issue) {
    const nextStatus = i.status === "open" ? "closed" : "open";
    const res = await fetch(`/api/admin/issues/${i.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) loadIssues();
  }

  const openIssueCount = issues.filter((i) => i.status === "open").length;
  const availableTabs: Tab[] = isSuperuser
    ? ["courses", "analytics", "issues", "users"]
    : ["courses", "analytics", "issues"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          {me && (
            <div className="text-xs text-neutral-500 mt-1">
              {t("signedInAs", {
                email: me.name ? `${me.name} <${me.email}>` : me.email,
                role:
                  me.role === "superuser"
                    ? t("roleSuperuser")
                    : t("roleCourseAdmin"),
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto print:hidden">
        {availableTabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={
              (tab === k
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white") +
              " px-4 py-2 border-b-2 text-sm font-medium transition whitespace-nowrap min-h-11"
            }
          >
            {t(k)}
            {k === "issues" && openIssueCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-xs">
                {openIssueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <div className="text-sm text-neutral-500">Loading...</div>}

      {!loading && tab === "courses" && (
        <div className="flex flex-col gap-3">
          {isSuperuser && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition min-h-11"
              >
                + {t("addCourse")}
              </button>
            </div>
          )}

          {courses.length === 0 ? (
            <div className="text-sm text-neutral-500">{t("noCourses")}</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {courses.map((c) => {
                const county = ESTONIAN_COUNTIES[c.county]?.et ?? c.county;
                return (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 flex items-center justify-between gap-3 flex-wrap"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {c.nameEt} <span className="text-neutral-400">/</span>{" "}
                        <span className="text-neutral-500">{c.nameEn}</span>
                      </div>
                      <div className="text-xs text-neutral-500">
                        {county}
                        {c.city ? ` · ${c.city}` : ""} · {c.holes.length}{" "}
                        {t("holes").toLowerCase()}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setQrFor(c)}
                        className="text-sm px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition min-h-11"
                      >
                        {t("qrCode")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(c)}
                        className="text-sm px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition min-h-11"
                        aria-label={t("editCourse")}
                      >
                        ✎
                      </button>
                      {isSuperuser && (
                        <button
                          type="button"
                          onClick={() => deleteCourse(c)}
                          className="text-sm px-3 py-1.5 rounded-full border border-red-300 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition min-h-11"
                        >
                          {t("delete")}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!loading && tab === "issues" && (
        <AdminIssues issues={issues} onChanged={loadIssues} />
      )}

      {!loading && tab === "analytics" && me && (
        <AdminAnalytics
          courses={courses.map((c) => ({
            id: c.id,
            nameEt: c.nameEt,
            nameEn: c.nameEn,
          }))}
          scope={isSuperuser ? "superuser" : "courseAdmin"}
        />
      )}

      {!loading && tab === "users" && isSuperuser && me && (
        <AdminUsers
          currentAdminId={me.id}
          courses={courses.map((c) => ({ id: c.id, nameEt: c.nameEt }))}
          onChanged={loadCourses}
        />
      )}

      {editing && (
        <CourseEditor
          initial={editing === "new" ? null : editing}
          canEditAssignments={isSuperuser}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadCourses();
            router.refresh();
          }}
        />
      )}

      {qrFor && <CourseQr course={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  );
}
