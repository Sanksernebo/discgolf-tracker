import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./admin";
import { sendMail } from "./mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
// Don't send another email if one went out this recently — stops someone
// from spamming an admin's inbox via the public forgot-password form.
const RESEND_COOLDOWN_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Base URL for links in reset emails. Prefers the server-only APP_URL over
 * request headers so a forged Host header can't point a reset link (and its
 * token) at someone else's domain. Set APP_URL in production.
 */
function resetBaseUrl(fallbackOrigin: string): string {
  return (process.env.APP_URL || fallbackOrigin).replace(/\/$/, "");
}

/**
 * Start a password reset for `email`. Always resolves the same way whether or
 * not the address exists, so the endpoint can't be used to probe for admins.
 */
export async function requestPasswordReset(
  email: string,
  opts: { locale: string; origin: string },
): Promise<void> {
  const admin = await prisma.admin.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!admin) {
    // Logged server-side only; the HTTP response stays identical.
    console.info("[password-reset] no admin with that email; nothing sent");
    return;
  }

  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      adminId: admin.id,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) {
    console.info(`[password-reset] throttled repeat request for ${admin.email}`);
    return;
  }

  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    // Only the newest link should work.
    prisma.passwordResetToken.deleteMany({ where: { adminId: admin.id } }),
    prisma.passwordResetToken.create({
      data: {
        adminId: admin.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  const link = `${resetBaseUrl(opts.origin)}/${opts.locale}/admin/reset-password?token=${token}`;
  const et = opts.locale === "et";
  const sent = await sendMail({
    to: admin.email,
    subject: et ? "Parooli lähtestamine" : "Password reset",
    text: et
      ? `Tere!\n\nKeegi (loodetavasti sina) palus lähtestada halduri konto parooli.\nAva see link tunni aja jooksul, et valida uus parool:\n\n${link}\n\nKui sa seda ei palunud, võid selle kirja lihtsalt kustutada.`
      : `Hi,\n\nSomeone (hopefully you) asked to reset the password for your admin account.\nOpen this link within an hour to choose a new password:\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
  if (sent) {
    console.info(`[password-reset] reset email sent to ${admin.email}`);
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[password-reset] email not sent; reset link for ${admin.email}: ${link}`);
  } else {
    console.error(
      `[password-reset] could not email ${admin.email}; check SMTP_* settings`,
    );
  }
}

/** True if the token exists, is unused and hasn't expired. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  return !!row && !row.usedAt && row.expiresAt > new Date();
}

/** Consume a reset token and set the new password. Returns false if invalid. */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<boolean> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.usedAt || row.expiresAt <= new Date()) return false;

  // Mark used conditionally so two concurrent submits can't both succeed.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  await prisma.$transaction([
    prisma.admin.update({
      where: { id: row.adminId },
      data: { passwordHash: hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { adminId: row.adminId, id: { not: row.id } },
    }),
  ]);
  return true;
}
