"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const STORAGE_KEY = "cookie-ack-v1";

export function CookieBanner() {
  const t = useTranslations("cookies");
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const acked = localStorage.getItem(STORAGE_KEY);
    if (!acked) setVisible(true);
  }, []);

  function acknowledge() {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      aria-describedby="cookie-desc"
      className="fixed inset-x-0 bottom-0 z-[1500] p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span
            className="text-2xl leading-none flex-shrink-0 mt-0.5"
            aria-hidden
          >
            🍪
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="cookie-title" className="font-semibold">
              {t("title")}
            </h2>
            <p
              id="cookie-desc"
              className="text-sm text-neutral-600 dark:text-neutral-300 mt-1"
            >
              {t("summary")}
            </p>
            {expanded && (
              <ul className="text-xs text-neutral-600 dark:text-neutral-400 mt-2 list-disc pl-5 space-y-1">
                <li>{t("detailDevice")}</li>
                <li>{t("detailLocale")}</li>
                <li>{t("detailTheme")}</li>
                <li>{t("detailAdmin")}</li>
                <li>{t("detailOsm")}</li>
                <li>{t("noTracking")}</li>
              </ul>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs mt-2 text-emerald-600 hover:underline focus:outline-none"
              aria-expanded={expanded}
            >
              {expanded ? t("less") : t("more")}
            </button>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={acknowledge}
            className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 focus:outline-none min-h-11"
          >
            {t("acknowledge")}
          </button>
        </div>
      </div>
    </div>
  );
}
