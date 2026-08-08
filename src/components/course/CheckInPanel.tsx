"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  PING_INTERVAL_MS,
  ACTIVE_WINDOW_MINUTES,
  MAX_PARTY_SIZE,
} from "@/lib/constants";
import { PushSetup } from "@/components/PushSetup";

type CheckIn = {
  id: string;
  startedAt: string;
  lastPingAt: string;
  partySize: number;
};

export function CheckInPanel({
  courseId,
  initialCheckIn,
}: {
  courseId: string;
  initialCheckIn: CheckIn | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [checkIn, setCheckIn] = useState<CheckIn | null>(initialCheckIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReprompt, setShowReprompt] = useState(false);
  // Pre-check-in party size (before the user hits "Check in").
  const [pendingPartySize, setPendingPartySize] = useState(1);
  const repromptTimer = useRef<number | null>(null);

  const scheduleReprompt = useCallback(() => {
    if (repromptTimer.current) {
      window.clearTimeout(repromptTimer.current);
    }
    // Show the "still here?" prompt at 2/3 of the auto-checkout window.
    const promptAfterMs = (ACTIVE_WINDOW_MINUTES * 60 * 1000 * 2) / 3;
    repromptTimer.current = window.setTimeout(() => {
      setShowReprompt(true);
    }, promptAfterMs);
  }, []);

  useEffect(() => {
    if (!checkIn) {
      if (repromptTimer.current) window.clearTimeout(repromptTimer.current);
      return;
    }
    scheduleReprompt();
    // Heartbeat while active.
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/ping", { method: "POST" });
        const data = (await res.json()) as {
          active: boolean;
          checkIn?: CheckIn;
        };
        if (!data.active) {
          setCheckIn(null);
        } else if (data.checkIn) {
          setCheckIn(data.checkIn);
        }
      } catch {
        /* ignore transient errors */
      }
    }, PING_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      if (repromptTimer.current) window.clearTimeout(repromptTimer.current);
    };
  }, [checkIn, scheduleReprompt]);

  async function postCheckIn(partySize: number) {
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId, partySize }),
    });
    if (!res.ok) throw new Error("checkin_failed");
    const data = (await res.json()) as { checkIn: CheckIn };
    setCheckIn(data.checkIn);
  }

  async function doCheckIn() {
    setBusy(true);
    setError(null);
    try {
      await postCheckIn(pendingPartySize);
      router.refresh();
    } catch {
      setError(t("checkin.error"));
    } finally {
      setBusy(false);
    }
  }

  /** Called from the active-check-in +/- buttons. Optimistic UI. */
  async function adjustParty(delta: number) {
    if (!checkIn) return;
    const next = Math.max(1, Math.min(MAX_PARTY_SIZE, checkIn.partySize + delta));
    if (next === checkIn.partySize) return;
    const previous = checkIn.partySize;
    setCheckIn({ ...checkIn, partySize: next });
    setBusy(true);
    try {
      await postCheckIn(next);
      router.refresh();
    } catch {
      // roll back
      setCheckIn({ ...checkIn, partySize: previous });
      setError(t("checkin.error"));
    } finally {
      setBusy(false);
    }
  }

  async function doCheckOut() {
    setBusy(true);
    try {
      await fetch("/api/checkout", { method: "POST" });
      setCheckIn(null);
      setShowReprompt(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function confirmStillHere() {
    setShowReprompt(false);
    try {
      await fetch("/api/ping", { method: "POST" });
      scheduleReprompt();
    } catch {
      /* ignore */
    }
  }

  if (checkIn) {
    const startedAt = new Date(checkIn.startedAt);
    return (
      <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {t("course.youAreHere")}
            </div>
            <div className="text-xs text-emerald-700 dark:text-emerald-300">
              {t("course.checkedInAt", {
                time: startedAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
              {" · "}
              {t("course.partyOf", { count: checkIn.partySize })}
            </div>
          </div>
          <button
            type="button"
            onClick={doCheckOut}
            disabled={busy}
            className="px-4 py-2 rounded-full bg-white dark:bg-neutral-900 border border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-neutral-800 transition disabled:opacity-50 min-h-11"
          >
            {t("course.checkOut")}
          </button>
        </div>

        {/* Party size +/- controls for a live check-in. */}
        <div
          role="group"
          aria-label={t("course.partySize")}
          className="flex items-center gap-3 text-sm text-emerald-800 dark:text-emerald-200"
        >
          <span>{t("course.partySize")}:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustParty(-1)}
              disabled={busy || checkIn.partySize <= 1}
              aria-label={t("course.removePlayer")}
              className="h-9 w-9 grid place-items-center rounded-full border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-neutral-800 disabled:opacity-40"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="min-w-6 text-center font-semibold"
            >
              {checkIn.partySize}
            </span>
            <button
              type="button"
              onClick={() => adjustParty(1)}
              disabled={busy || checkIn.partySize >= MAX_PARTY_SIZE}
              aria-label={t("course.addPlayer")}
              className="h-9 w-9 grid place-items-center rounded-full border border-emerald-400 dark:border-emerald-700 bg-white dark:bg-neutral-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-neutral-800 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>

        <PushSetup
          compact
          className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white/60 dark:bg-neutral-900/60 p-2 flex items-center justify-between gap-3 flex-wrap"
        />

        {showReprompt && (
          <div className="rounded-xl bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-700 p-3 flex items-center justify-between gap-3">
            <div className="text-sm">{t("course.stillHerePrompt")}</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmStillHere}
                className="px-3 py-1.5 text-sm rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition min-h-11"
              >
                {t("course.stillHere")}
              </button>
              <button
                type="button"
                onClick={doCheckOut}
                className="px-3 py-1.5 text-sm rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition min-h-11"
              >
                {t("course.leaveNow")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col gap-3">
      <div className="text-sm text-neutral-600 dark:text-neutral-300">
        {t("course.checkIn")}
      </div>

      {/* Party size selector before check-in. Default 1 = one click to check in solo. */}
      <div
        role="group"
        aria-label={t("course.partySize")}
        className="flex items-center gap-3 text-sm"
      >
        <span className="text-neutral-600 dark:text-neutral-300">
          {t("course.partySize")}:
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPendingPartySize((v) => Math.max(1, v - 1))}
            disabled={busy || pendingPartySize <= 1}
            aria-label={t("course.removePlayer")}
            className="h-9 w-9 grid place-items-center rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-6 text-center font-semibold"
          >
            {pendingPartySize}
          </span>
          <button
            type="button"
            onClick={() =>
              setPendingPartySize((v) => Math.min(MAX_PARTY_SIZE, v + 1))
            }
            disabled={busy || pendingPartySize >= MAX_PARTY_SIZE}
            aria-label={t("course.addPlayer")}
            className="h-9 w-9 grid place-items-center rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-500">{t("course.partySizeHelp")}</p>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-neutral-500">
          {t("course.partyOf", { count: pendingPartySize })}
        </div>
        <button
          type="button"
          onClick={doCheckIn}
          disabled={busy}
          className="px-4 py-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 min-h-11"
        >
          {busy ? t("checkin.checkingIn") : t("course.checkIn")}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
