"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";
type StoredTheme = Theme | "system" | null;

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") as StoredTheme;
    const initialTheme =
      stored === "light" || stored === "dark" ? stored : getSystemTheme();

    setTheme(initialTheme);
    setMounted(true);
    applyTheme(initialTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      const currentStored = localStorage.getItem("theme") as StoredTheme;

      // Follow the system only when the user has not explicitly chosen a theme.
      if (currentStored !== "light" && currentStored !== "dark") {
        const systemTheme = getSystemTheme();
        setTheme(systemTheme);
        applyTheme(systemTheme);
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  function choose(nextTheme: Theme) {
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    applyTheme(nextTheme);
  }

  const options: { key: Theme; icon: string; label: string }[] = [
    { key: "light", icon: "☀", label: t("light") },
    { key: "dark", icon: "☾", label: t("dark") },
  ];

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex items-center gap-0.5 rounded-full border border-neutral-200 p-0.5 dark:border-neutral-700"
    >
      {options.map((option) => {
        const active = mounted && theme === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => choose(option.key)}
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            className={
              (active
                ? "bg-emerald-500 text-white"
                : "text-neutral-600 hover:text-emerald-600 dark:text-neutral-300") +
              " grid h-8 w-8 place-items-center rounded-full text-sm transition"
            }
          >
            <span aria-hidden="true">{option.icon}</span>
          </button>
        );
      })}
    </div>
  );
}
