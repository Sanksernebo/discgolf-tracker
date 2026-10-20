import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, isSuperuser } from "@/lib/admin";

const HISTORY_LIMIT = 100;

/** Recent successful sign-ins for one admin, newest first. Superuser only. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isSuperuser(admin)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const logins = await prisma.adminLoginEvent.findMany({
    where: { adminId: id },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, ip: true, userAgent: true, createdAt: true },
  });
  return NextResponse.json({ logins });
}
