import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/password-reset";
import { publicOriginFromRequest } from "@/lib/public-url";
import { routing } from "@/i18n/routing";

const Body = z.object({
  email: z.string().email().max(200),
  locale: z.enum(routing.locales).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await requestPasswordReset(parsed.data.email, {
    locale: parsed.data.locale ?? routing.defaultLocale,
    origin: publicOriginFromRequest(req),
  });
  // Same response whether or not the email belongs to an admin.
  return NextResponse.json({ ok: true });
}
