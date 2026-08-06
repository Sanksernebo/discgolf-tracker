import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, canEditCourse, isSuperuser } from "@/lib/admin";

const Body = z.object({ status: z.enum(["open", "closed"]) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const issue = await prisma.issueReport.findUnique({ where: { id } });
  if (!issue) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // App-level reports (no course) are only accessible to superuser.
  if (issue.courseId == null) {
    if (!isSuperuser(admin)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else if (!canEditCourse(admin, issue.courseId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const updated = await prisma.issueReport.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  return NextResponse.json({ issue: updated });
}
