"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function AdminLogin() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError(t("wrongPassword"));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12">
      <h1 className="text-2xl font-semibold mb-4">{t("title")}</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-500">{t("password")}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2 focus:outline-none focus:border-emerald-500"
          />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 min-h-11"
        >
          {t("signIn")}
        </button>
      </form>
    </div>
  );
}
