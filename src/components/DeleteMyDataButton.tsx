"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Result = {
  deleted: {
    checkIns: number;
    issueReports: number;
    pushSubscriptions: number;
  };
};

/**
 * Client-side trigger for the right-to-erasure endpoint. The button is
 * self-contained: it confirms, calls the endpoint, and reports how many rows
 * were removed so the user knows the request actually did something (not a
 * silent success on an empty account).
 */
export function DeleteMyDataButton() {
  const t = useTranslations("privacy");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "done"; result: Result }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function run() {
    if (!confirm(t("deleteConfirm"))) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/me/delete", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as Result;
      setState({ kind: "done", result: body });
    } catch (e: unknown) {
      setState({ kind: "error", message: String(e) });
    }
  }

  if (state.kind === "done") {
    const d = state.result.deleted;
    return (
      <div className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 p-4 text-sm">
        <p className="font-medium text-emerald-800 dark:text-emerald-200">
          {t("deleteSuccess")}
        </p>
        <p className="mt-1 text-emerald-700 dark:text-emerald-300">
          {t("deleteSuccessDetail", {
            checkIns: d.checkIns,
            issues: d.issueReports,
            push: d.pushSubscriptions,
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 items-start">
      <button
        type="button"
        onClick={run}
        disabled={state.kind === "loading"}
        className="px-4 py-2 rounded-full border border-red-300 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition min-h-11 disabled:opacity-60"
      >
        {state.kind === "loading" ? t("deleteWorking") : t("deleteButton")}
      </button>
      {state.kind === "error" && (
        <p className="text-xs text-red-600" role="alert">
          {t("deleteError")} ({state.message})
        </p>
      )}
    </div>
  );
}
