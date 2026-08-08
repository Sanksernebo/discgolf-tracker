import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Body = z.object({ endpoint: z.string().url().max(500) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  await prisma.pushSubscription
    .delete({ where: { endpoint: parsed.data.endpoint } })
    .catch(() => {
      // Not found is fine — already unsubscribed.
    });
  return NextResponse.json({ ok: true });
}
