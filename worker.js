/**
 * Second PM2 process. Runs a loop that scans active check-ins and delivers
 * two kinds of push notifications:
 *
 *   1. Periodic reminder — every REMINDER_INTERVAL_MIN while active,
 *      "You're still marked on <course>. Tap to confirm or check out."
 *   2. Pre-checkout warning — once, WARNING_LEAD_MIN before the session's
 *      auto-checkout window closes, "You will be checked out soon."
 *
 * PM2 setup on Zone:
 *   Application name: discgolf-worker
 *   Script or PM2 .JSON: <project-path>/worker.js
 *   Max memory: 100 MiB (this process holds almost nothing in memory)
 *
 * The worker is independent from the web server (server.js) — either can be
 * restarted alone. It reads the same .env for DATABASE_URL and VAPID keys.
 */

require("@next/env").loadEnvConfig(__dirname, false);

const { PrismaClient } = require("@prisma/client");
const webPush = require("web-push");

const TICK_INTERVAL_MS = 5 * 60 * 1000; // scan every 5 minutes
const REMINDER_INTERVAL_MIN = 90; // ping user every 90 minutes
const WARNING_LEAD_MIN = 15; // warning fires 15 min before auto-checkout
const ACTIVE_WINDOW_MIN = 180; // matches src/lib/constants.ts ACTIVE_WINDOW_MINUTES

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const contact = process.env.VAPID_CONTACT || "mailto:info@digiarendus.ee";

if (!publicKey || !privateKey) {
  console.warn(
    "[worker] VAPID keys missing — pushes will be skipped. Run 'node scripts/generate-vapid.mjs' and add the output to .env, then restart.",
  );
} else {
  webPush.setVapidDetails(contact, publicKey, privateKey);
}

const prisma = new PrismaClient();

async function sendToDevice(deviceId, payload) {
  if (!publicKey || !privateKey) return { sent: 0, removed: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { deviceId } });
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6 },
        );
        sent += 1;
      } catch (err) {
        const status = err && err.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => {});
          removed += 1;
        } else {
          console.warn("[worker] push failed:", status, err && err.body);
        }
      }
    }),
  );
  return { sent, removed };
}

async function tick() {
  const now = new Date();
  const activeSince = new Date(now.getTime() - ACTIVE_WINDOW_MIN * 60 * 1000);
  const reminderCutoff = new Date(
    now.getTime() - REMINDER_INTERVAL_MIN * 60 * 1000,
  );
  const warningThreshold = new Date(
    now.getTime() - (ACTIVE_WINDOW_MIN - WARNING_LEAD_MIN) * 60 * 1000,
  );

  const active = await prisma.checkIn.findMany({
    where: {
      endedAt: null,
      lastPingAt: { gt: activeSince },
    },
    include: {
      course: { select: { id: true, nameEt: true } },
    },
  });

  for (const ci of active) {
    // Pre-checkout warning: lastPingAt is old enough that auto-checkout is
    // near, and we haven't already warned this session.
    if (!ci.warningSentAt && ci.lastPingAt <= warningThreshold) {
      await sendToDevice(ci.deviceId, {
        title: "⚠️ Discgolfi jälgija",
        body: `Sind märgitakse peagi rajalt lahkunuks: ${ci.course.nameEt}. Kinnita, et oled endiselt kohal.`,
        url: `/et/course/${ci.course.id}`,
        tag: `warning:${ci.course.id}`,
      });
      await prisma.checkIn.update({
        where: { id: ci.id },
        data: { warningSentAt: now },
      });
      continue; // don't also send a reminder in the same tick
    }

    // Periodic reminder: only if we haven't reminded recently.
    const lastReminder = ci.lastReminderAt ?? ci.startedAt;
    if (lastReminder <= reminderCutoff) {
      await sendToDevice(ci.deviceId, {
        title: "⛳ Discgolfi jälgija",
        body: `Oled märgitud rajale: ${ci.course.nameEt}. Kas oled endiselt kohal?`,
        url: `/et/course/${ci.course.id}`,
        tag: `reminder:${ci.course.id}`,
      });
      await prisma.checkIn.update({
        where: { id: ci.id },
        data: { lastReminderAt: now },
      });
    }
  }
}

async function main() {
  console.log(
    `[worker] discgolf-worker starting; tick=${TICK_INTERVAL_MS / 1000}s, reminder=${REMINDER_INTERVAL_MIN}m, warning-lead=${WARNING_LEAD_MIN}m`,
  );
  // First tick immediately so restarts have quick effect.
  await tick().catch((err) => console.error("[worker] initial tick failed:", err));
  setInterval(() => {
    tick().catch((err) => console.error("[worker] tick failed:", err));
  }, TICK_INTERVAL_MS);
}

main();
