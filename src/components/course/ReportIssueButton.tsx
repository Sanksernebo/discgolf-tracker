"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Category = "course" | "app" | "other";

export function ReportIssueButton({
  courseId,
  variant = "block",
}: {
  courseId?: string;
  variant?: "block" | "link";
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>(
    courseId ? "course" : "app",
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the first focusable element (the close button) when the dialog opens.
    const el = dialogRef.current?.querySelector<HTMLElement>(
      "button, input, textarea, select, [tabindex]",
    );
    el?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          courseId: category === "course" ? courseId ?? null : null,
          category,
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error("send_failed");
      setSent(true);
      setMessage("");
    } catch {
      setError(t("issue.error"));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
    setSent(false);
    setError(null);
  }

  return (
    <>
      {variant === "block" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
        >
          🛠️ {t("course.reportIssue")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm hover:text-emerald-600 transition-colors"
        >
          {t("nav.reportIssue")}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center p-2"
          onClick={close}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-title"
            className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="issue-title" className="text-lg font-semibold">
                {t("issue.title")}
              </h2>
              <button
                type="button"
                onClick={close}
                className="h-9 w-9 grid place-items-center rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition"
                aria-label={t("a11y.closeDialog")}
              >
                <span aria-hidden>✕</span>
              </button>
            </div>

            {sent ? (
              <div className="py-4 text-sm text-emerald-600">
                {t("issue.success")}
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase text-neutral-500">
                    {t("issue.categoryLabel")}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(["course", "app", "other"] as const).map((c) => {
                      const disabled = c === "course" && !courseId;
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={disabled}
                          onClick={() => setCategory(c)}
                          className={
                            (category === c
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700") +
                            " text-sm px-3 py-1.5 rounded-full border transition disabled:opacity-40"
                          }
                        >
                          {t(
                            `issue.category${
                              c === "course"
                                ? "Course"
                                : c === "app"
                                  ? "App"
                                  : "Other"
                            }`,
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="issue-msg"
                    className="text-xs uppercase text-neutral-500"
                  >
                    {t("issue.descriptionLabel")}
                  </label>
                  <textarea
                    id="issue-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder={t("issue.descriptionPlaceholder")}
                    className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2 text-sm focus:outline-none focus:border-emerald-500"
                    required
                    minLength={3}
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600">{error}</div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 text-sm rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                  >
                    {t("issue.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={busy || message.trim().length < 3}
                    className="px-4 py-2 text-sm rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50"
                  >
                    {t("issue.submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
