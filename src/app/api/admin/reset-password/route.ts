import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/password-reset";

const Body = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const ok = await resetPassword(parsed.data.token, parsed.data.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
