"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);
    // Re-apply on mount as well as at initial page load. next-intl's
    // language switch re-renders the root layout with a fresh server
    // response that has no .dark class on <html>; without this, React
    // reconciles the class off and the theme silently flips.
    applyTheme(stored);

    // React to system-preference changes while on "system".
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if ((localStorage.getItem("theme") as Theme | null) === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }

  const options: { key: Theme; icon: string; label: string }[] = [
    { key: "light", icon: "☀", label: t("light") },
    { key: "system", icon: "◐", label: t("system") },
    { key: "dark", icon: "☾", label: t("dark") },
  ];

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex items-center gap-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 p-0.5"
    >
      {options.map((o) => {
        const active = mounted && theme === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => choose(o.key)}
            aria-pressed={active}
            aria-label={o.label}
            title={o.label}
            className={
              (active
                ? "bg-emerald-500 text-white"
                : "text-neutral-600 dark:text-neutral-300 hover:text-emerald-600") +
              " h-8 w-8 grid place-items-center rounded-full text-sm transition"
            }
          >
            <span aria-hidden>{o.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
