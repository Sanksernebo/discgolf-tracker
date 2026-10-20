import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    // Mail isn't set up — legal in dev, callers fall back to logging.
    transporter = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });
  return transporter;
}

export type MailMessage = { to: string; subject: string; text: string };

/**
 * Send a plain-text email. Returns false (without throwing) when SMTP isn't
 * configured or the send fails, so callers can degrade gracefully.
 */
export async function sendMail(msg: MailMessage): Promise<boolean> {
  const t = getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      ...msg,
    });
    return true;
  } catch (err) {
    console.error("[mail] send failed", err);
    return false;
  }
}
