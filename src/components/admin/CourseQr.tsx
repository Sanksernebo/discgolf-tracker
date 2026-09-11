"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import type { CourseWithHoles } from "./CourseEditor";

export function CourseQr({
  course,
  onClose,
}: {
  course: CourseWithHoles;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // Always trust the browser origin the admin is viewing the panel from:
    // by definition that IS the public URL end users will scan into, and it
    // survives moving the app between subdomains (e.g. digiarendus.ee →
    // disctracker.digiarendus.ee) without a rebuild.
    //
    // NEXT_PUBLIC_APP_URL used to win here as a "production override" but
    // that turned into a footgun — a stale build-time value silently
    // produced QRs pointing at the wrong domain (real bug: env said
    // `digiarendus.ee` while the app was actually at
    // `disctracker.digiarendus.ee`, so every printed QR 404ed). Kept only
    // as a last-resort fallback for the impossible-in-a-client-component
    // case where `window` isn't available.
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin.replace(/\/$/, ""));
      return;
    }
    const explicit = process.env.NEXT_PUBLIC_APP_URL;
    if (explicit) setOrigin(explicit.replace(/\/$/, ""));
  }, []);

  const url = origin ? `${origin}/checkin/${course.id}` : "";

  function print() {
    window.print();
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-2 print:bg-white"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-3 items-center print:border-0 print:shadow-none print:dark:bg-white print:text-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full print:hidden">
          <h2 id="qr-title" className="text-lg font-semibold">{t("qrCode")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="h-9 w-9 grid place-items-center rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold">{course.nameEt}</div>
          <div className="text-sm text-neutral-500">{course.nameEn}</div>
        </div>

        <div className="bg-white p-4 rounded-xl">
          {url && (
            <QRCodeSVG
              value={url}
              size={240}
              level="M"
              marginSize={2}
            />
          )}
        </div>

        <div className="text-xs text-neutral-500 break-all text-center">
          {url}
        </div>

        <div className="text-sm text-neutral-600 dark:text-neutral-300 text-center max-w-xs">
          <div className="font-medium">Skanni & alusta mängu</div>
          <div className="opacity-70">Scan to check in</div>
        </div>

        <div className="flex gap-2 print:hidden">
          <button
            type="button"
            onClick={print}
            className="px-4 py-2 text-sm rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition"
          >
            🖨️ {t("printQr")}
          </button>
        </div>
      </div>
    </div>
  );
}
