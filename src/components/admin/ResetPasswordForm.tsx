"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const inputCls =
  "rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2 focus:outline-none focus:border-emerald-500";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("admin");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(token === null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        setInvalid(true);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-semibold mb-4">{t("resetPasswordTitle")}</h1>
      {done ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {t("resetPasswordDone")}
        </p>
      ) : invalid ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-red-600">{t("resetLinkInvalid")}</p>
          <Link
            href="/admin/forgot-password"
            className="text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            {t("requestNewLink")}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("newPasswordLabel")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              required
              minLength={8}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("confirmPassword")}</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className={inputCls}
            />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={busy || !password || !confirm}
            className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 min-h-11"
          >
            {t("setNewPassword")}
          </button>
        </form>
      )}
      <Link
        href="/admin"
        className="mt-4 inline-block text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
      >
        {t("backToSignIn")}
      </Link>
    </div>
  );
}
