import webPush from "web-push";
import { prisma } from "./prisma";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? "mailto:info@digiarendus.ee";
  if (!publicKey || !privateKey) {
    // Push isn't set up — legal in dev, we just don't send.
    return false;
  }
  webPush.setVapidDetails(contact, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Optional deep-link path (e.g. "/et/course/xxx"). */
  url?: string;
  /**
   * Notification tag — pushes with the same tag replace each other in the
   * OS notification center instead of stacking. Use "checkin:<courseId>"
   * so a group of pushes for one course collapses to one visible chip.
   */
  tag?: string;
};

/**
 * Send a push to every subscription registered for a device. Removes stale
 * subscriptions (410 Gone / 404 Not Found from the push service) so the
 * table doesn't fill up with dead endpoints.
 */
export async function sendPushToDevice(
  deviceId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!ensureConfigured()) return { sent: 0, removed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: { deviceId },
  });
  if (subs.length === 0) return { sent: 0, removed: 0 };

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
          { TTL: 60 * 60 * 6 }, // 6 hours — matches our active-session window roughly
        );
        sent += 1;
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          // Subscription is dead; remove so we don't keep retrying.
          await prisma.pushSubscription.delete({ where: { id: s.id } });
          removed += 1;
        } else {
          // Unknown transient failure — log and move on.
          console.warn("push send failed:", status, err);
        }
      }
    }),
  );
  return { sent, removed };
}
