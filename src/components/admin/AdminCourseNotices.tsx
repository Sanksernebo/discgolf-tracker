"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

type NoticeType = "info" | "event" | "maintenance" | "closed";

type Notice = {
  id: string;
  courseId: string;
  type: NoticeType;
  titleEt: string;
  titleEn: string;
  messageEt: string;
  messageEn: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

type NoticeForm = {
  type: NoticeType;
  titleEt: string;
  titleEn: string;
  messageEt: string;
  messageEn: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const emptyForm: NoticeForm = {
  type: "info",
  titleEt: "",
  titleEn: "",
  messageEt: "",
  messageEn: "",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

const typeKeys: NoticeType[] = ["info", "event", "maintenance", "closed"];

function toLocalDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminCourseNotices({
  courseId,
  courseName,
  onClose,
}: {
  courseId: string;
  courseName: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin.courseNotices");

  const [notices, setNotices] = useState<Notice[]>([]);
  const [form, setForm] = useState<NoticeForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const endpoint = `/api/admin/courses/${courseId}/notices`;

  // Sulgeb modali Escape-klahviga
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotices() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(endpoint);

        if (!res.ok) {
          throw new Error("load");
        }

        const data = (await res.json()) as { notices: Notice[] };

        if (!cancelled) {
          setNotices(data.notices);
        }
      } catch {
        if (!cancelled) {
          setError(t("loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadNotices();

    return () => {
      cancelled = true;
    };
  }, [endpoint, t]);

  function updateForm<K extends keyof NoticeForm>(
    key: K,
    value: NoticeForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(notice: Notice) {
    setEditingId(notice.id);

    setForm({
      type: notice.type,
      titleEt: notice.titleEt,
      titleEn: notice.titleEn,
      messageEt: notice.messageEt,
      messageEn: notice.messageEn,
      isActive: notice.isActive,
      startsAt: toLocalDateTime(notice.startsAt),
      endsAt: toLocalDateTime(notice.endsAt),
    });

    setError("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  }

  async function saveNotice(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (
      form.startsAt &&
      form.endsAt &&
      new Date(form.endsAt) < new Date(form.startsAt)
    ) {
      setError(t("dateError"));
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };

    try {
      const res = await fetch(endpoint, {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId } : payload,
        ),
      });

      if (!res.ok) {
        throw new Error("save");
      }

      resetForm();
      await loadNotices();
    } catch {
      setError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function loadNotices() {
    try {
      const res = await fetch(endpoint);

      if (!res.ok) {
        throw new Error("load");
      }

      const data = (await res.json()) as { notices: Notice[] };
      setNotices(data.notices);
    } catch {
      setError(t("loadError"));
    }
  }

  async function deleteNotice(notice: Notice) {
    if (!confirm(t("confirmDelete", { title: notice.titleEt }))) {
      return;
    }

    setError("");

    try {
      const res = await fetch(
        `${endpoint}?noticeId=${encodeURIComponent(notice.id)}`,
        { method: "DELETE" },
      );

      if (!res.ok) {
        throw new Error("delete");
      }

      if (editingId === notice.id) {
        resetForm();
      }

      await loadNotices();
    } catch {
      setError(t("deleteError"));
    }
  }

  const fieldClass =
    "w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 p-2 min-h-11 focus:outline-none focus:ring-2 focus:ring-emerald-500";

  const textAreaClass =
    "w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-500";

  const labelClass = "text-sm flex flex-col gap-1";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-notices-title"
        className="bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 id="course-notices-title" className="text-xl font-semibold">
              {t("title")}
            </h2>

            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {courseName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 min-h-11 transition"
          >
            {t("close")}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 mb-4"
          >
            {error}
          </p>
        )}

        <form
          onSubmit={saveNotice}
          className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50 p-4 flex flex-col gap-3 mb-6"
        >
          <h3 className="font-semibold">
            {editingId ? t("editNotice") : t("addNotice")}
          </h3>

          <label className={labelClass}>
            {t("type")}
            <select
              value={form.type}
              onChange={(e) => updateForm("type", e.target.value as NoticeType)}
              className={fieldClass}
            >
              {typeKeys.map((type) => (
                <option
                  key={type}
                  value={type}
                  className="bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  {t(`types.${type}`)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelClass}>
              {t("titleEt")}
              <input
                required
                maxLength={160}
                value={form.titleEt}
                onChange={(e) => updateForm("titleEt", e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className={labelClass}>
              {t("titleEn")}
              <input
                required
                maxLength={160}
                value={form.titleEn}
                onChange={(e) => updateForm("titleEn", e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelClass}>
              {t("messageEt")}
              <textarea
                required
                rows={4}
                value={form.messageEt}
                onChange={(e) => updateForm("messageEt", e.target.value)}
                className={textAreaClass}
              />
            </label>

            <label className={labelClass}>
              {t("messageEn")}
              <textarea
                required
                rows={4}
                value={form.messageEn}
                onChange={(e) => updateForm("messageEn", e.target.value)}
                className={textAreaClass}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelClass}>
              {t("startsAt")}
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => updateForm("startsAt", e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className={labelClass}>
              {t("endsAt")}
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => updateForm("endsAt", e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm min-h-11">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateForm("isActive", e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            {t("active")}
          </label>

          <div className="flex gap-2 flex-wrap">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-emerald-600 text-white px-4 py-2 min-h-11 hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {saving
                ? t("saving")
                : editingId
                  ? t("saveChanges")
                  : t("addNotice")}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-4 py-2 min-h-11 transition"
              >
                {t("cancel")}
              </button>
            )}
          </div>
        </form>

        <h3 className="font-semibold mb-3">{t("existingNotices")}</h3>

        {loading ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("loading")}
          </p>
        ) : notices.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t("noNotices")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {notices.map((notice) => (
              <div
                key={notice.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{notice.titleEt}</div>

                    <div className="text-sm text-neutral-500 dark:text-neutral-400">
                      {t(`types.${notice.type}`)} ·{" "}
                      {notice.isActive
                        ? t("activeStatus")
                        : t("inactiveStatus")}
                    </div>

                    <p className="text-sm mt-2 whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                      {notice.messageEt}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(notice)}
                      className="text-sm rounded-full border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-3 py-1.5 min-h-11 transition"
                    >
                      {t("edit")}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteNotice(notice)}
                      className="text-sm rounded-full border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 px-3 py-1.5 min-h-11 transition"
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
