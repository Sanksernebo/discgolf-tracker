"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type AdminSummary = {
  id: string;
  email: string;
  role: "superuser" | "courseAdmin";
  createdAt: string;
  courses: { id: string; nameEt: string; nameEn: string }[];
};

type CourseOption = { id: string; nameEt: string };

export function AdminUsers({
  currentAdminId,
  courses,
  onChanged,
}: {
  currentAdminId: string;
  courses: CourseOption[];
  onChanged: () => void;
}) {
  const t = useTranslations("admin");
  const [admins, setAdmins] = useState<AdminSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminSummary | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const courseNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) map.set(c.id, c.nameEt);
    return map;
  }, [courses]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins");
      if (!res.ok) {
        setError("load_failed");
        return;
      }
      const data = (await res.json()) as { admins: AdminSummary[] };
      setAdmins(data.admins);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(a: AdminSummary) {
    if (a.id === currentAdminId) {
      alert(t("cannotDeleteSelf"));
      return;
    }
    if (!confirm(t("confirmDelete"))) return;
    const res = await fetch(`/api/admin/admins/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error === "last_superuser" ? t("lastSuperuser") : t("error" as never));
      return;
    }
    load();
    onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition min-h-11"
        >
          + {t("addUser")}
        </button>
      </div>

      {loading && <div className="text-sm text-neutral-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && admins.length === 0 && (
        <div className="text-sm text-neutral-500">{t("noUsers")}</div>
      )}

      {!loading && admins.length > 0 && (
        <ul className="flex flex-col gap-2">
          {admins.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-3 flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium break-all">{a.email}</span>
                  <span
                    className={
                      (a.role === "superuser"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300") +
                      " text-xs px-2 py-0.5 rounded-full"
                    }
                  >
                    {a.role === "superuser"
                      ? t("roleSuperuser")
                      : t("roleCourseAdmin")}
                  </span>
                  {a.id === currentAdminId && (
                    <span className="text-xs text-neutral-500">(you)</span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {t("createdOn", {
                    date: new Date(a.createdAt).toLocaleDateString(),
                  })}
                </div>
                {a.role === "courseAdmin" && (
                  <div className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {a.courses.length === 0 ? (
                      <span className="italic">{t("noAssignments")}</span>
                    ) : (
                      <span>
                        {a.courses
                          .map((c) => courseNameById.get(c.id) ?? c.nameEt)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(a)}
                  className="text-sm px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-11"
                  aria-label={t("editUser")}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => remove(a)}
                  disabled={a.id === currentAdminId}
                  className="text-sm px-3 py-1.5 rounded-full border border-red-300 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-40 min-h-11"
                >
                  {t("delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <AdminEditor
          initial={editing === "new" ? null : editing}
          courses={courses}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Editor                                    */
/* -------------------------------------------------------------------------- */

type EditorDraft = {
  email: string;
  password: string;
  role: "superuser" | "courseAdmin";
  courseIds: string[];
};

function AdminEditor({
  initial,
  courses,
  onClose,
  onSaved,
}: {
  initial: AdminSummary | null;
  courses: CourseOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("admin");
  const [draft, setDraft] = useState<EditorDraft>(() => ({
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? "courseAdmin",
    courseIds: initial?.courses.map((c) => c.id) ?? [],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCourse(id: string) {
    setDraft((d) => ({
      ...d,
      courseIds: d.courseIds.includes(id)
        ? d.courseIds.filter((x) => x !== id)
        : [...d.courseIds, id],
    }));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        email: draft.email.trim().toLowerCase(),
        role: draft.role,
        courseIds: draft.role === "courseAdmin" ? draft.courseIds : [],
      };
      if (draft.password) body.password = draft.password;

      const isNew = !initial;
      if (isNew) {
        if (!draft.password || draft.password.length < 8) {
          setError(t("passwordTooShort"));
          return;
        }
      }

      const res = await fetch(
        isNew ? "/api/admin/admins" : `/api/admin/admins/${initial!.id}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "email_taken") setError(t("emailTaken"));
        else if (body.error === "last_superuser") setError(t("lastSuperuser"));
        else setError(JSON.stringify(body.error ?? "error"));
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-2 overflow-y-auto"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-editor-title"
        className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col gap-3 my-8 max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="admin-editor-title" className="text-lg font-semibold">
            {initial ? t("editUser") : t("addUser")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="h-9 w-9 grid place-items-center rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase text-neutral-500">
            {t("email")}
          </span>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            autoComplete="off"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase text-neutral-500">
            {initial ? t("newPassword") : t("password")}
          </span>
          <input
            type="password"
            value={draft.password}
            onChange={(e) => setDraft({ ...draft, password: e.target.value })}
            autoComplete="new-password"
            className={inputCls}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase text-neutral-500">{t("role")}</span>
          <select
            value={draft.role}
            onChange={(e) =>
              setDraft({ ...draft, role: e.target.value as EditorDraft["role"] })
            }
            className={inputCls}
          >
            <option value="courseAdmin">{t("roleCourseAdmin")}</option>
            <option value="superuser">{t("roleSuperuser")}</option>
          </select>
        </label>

        {draft.role === "courseAdmin" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs uppercase text-neutral-500">
              {t("assignedCourses")}
            </legend>
            {courses.length === 0 ? (
              <div className="text-sm text-neutral-500">{t("noCourses")}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 p-2">
                {courses.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={draft.courseIds.includes(c.id)}
                      onChange={() => toggleCourse(c.id)}
                      className="h-4 w-4"
                    />
                    <span>{c.nameEt}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-11"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !draft.email}
            className="px-4 py-2 text-sm rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 min-h-11"
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500";
