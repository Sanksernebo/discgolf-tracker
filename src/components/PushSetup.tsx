"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Status =
  | "unsupported"
  | "needs-install-ios"
  | "needs-permission"
  | "denied"
  | "subscribed"
  | "loading";

/** Convert a base64url string (VAPID public key) to a Uint8Array. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const b = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Detects iOS Safari that hasn't been installed to home screen yet. Push on
 * iOS requires the site to be launched from the home-screen icon; requesting
 * notification permission from a normal Safari tab silently fails.
 */
function isIosNeedingInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  if (!isIos) return false;
  const displayMode =
    "standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone;
  // matchMedia is more reliable across newer iOS
  const mm = window.matchMedia("(display-mode: standalone)").matches;
  return !(displayMode || mm);
}

export function PushSetup({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("push");
  const [status, setStatus] = useState<Status>("loading");

  const computeStatus = useCallback(async (): Promise<Status> => {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Older iOS Safari (< 16.4) or unsupported browser.
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        return isIosNeedingInstall() ? "needs-install-ios" : "unsupported";
      }
      return "unsupported";
    }
    if (isIosNeedingInstall()) return "needs-install-ios";
    if (Notification.permission === "denied") return "denied";
    // Do we already have an active subscription?
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub && Notification.permission === "granted") return "subscribed";
    } catch {
      /* ignore */
    }
    return "needs-permission";
  }, []);

  useEffect(() => {
    computeStatus().then(setStatus);
  }, [computeStatus]);

  async function enable() {
    setStatus("loading");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY missing at build time");
        setStatus("unsupported");
        return;
      }

      // Register service worker if it isn't yet.
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "needs-permission");
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // Cast — the DOM types demand a strict ArrayBuffer but any
          // BufferSource works at runtime.
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh?: string; auth?: string };
      };
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
          },
        }),
      });

      setStatus("subscribed");
    } catch (err) {
      console.error("push enable failed:", err);
      setStatus("needs-permission");
    }
  }

  async function disable() {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
    } finally {
      setStatus(await computeStatus());
    }
  }

  const wrap = (children: React.ReactNode) => (
    <div
      className={
        (compact ? "text-xs" : "text-sm") +
        " " +
        (className ??
          "rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex items-center justify-between gap-3 flex-wrap")
      }
    >
      {children}
    </div>
  );

  if (status === "loading") {
    return wrap(<span className="text-neutral-500">{t("loading")}</span>);
  }
  if (status === "unsupported") {
    // Silent — no notification support at all. Don't clutter the UI.
    return null;
  }
  if (status === "needs-install-ios") {
    return wrap(
      <>
        <span className="text-neutral-700 dark:text-neutral-200">
          📱 {t("iosInstallHint")}
        </span>
      </>,
    );
  }
  if (status === "denied") {
    return wrap(
      <span className="text-neutral-500">{t("denied")}</span>,
    );
  }
  if (status === "subscribed") {
    return wrap(
      <>
        <span className="text-emerald-700 dark:text-emerald-300">
          🔔 {t("enabled")}
        </span>
        <button
          type="button"
          onClick={disable}
          className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-9"
        >
          {t("disable")}
        </button>
      </>,
    );
  }
  return wrap(
    <>
      <span className="text-neutral-700 dark:text-neutral-200">
        🔔 {t("prompt")}
      </span>
      <button
        type="button"
        onClick={enable}
        className="text-xs px-3 py-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 min-h-9"
      >
        {t("enable")}
      </button>
    </>,
  );
}
