"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ForgotPasswordForm() {
  const t = useTranslations("admin");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (!res.ok) {
        setError(t("resetRequestFailed"));
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-semibold mb-2">{t("forgotPasswordTitle")}</h1>
      {sent ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {t("resetEmailSent")}
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <p className="text-sm text-neutral-500">{t("forgotPasswordIntro")}</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-500">{t("email")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
              className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2 focus:outline-none focus:border-emerald-500"
            />
          </label>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={busy || !email}
            className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 min-h-11"
          >
            {t("sendResetLink")}
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
