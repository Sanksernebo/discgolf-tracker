import { NextResponse } from "next/server";
import { z } from "zod";
import { signIn } from "@/lib/admin";

const Body = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const admin = await signIn(parsed.data.email, parsed.data.password);
  if (!admin) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  return NextResponse.json({
    admin: { id: admin.id, email: admin.email, role: admin.role },
  });
}
