import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, editableCourseIds } from "@/lib/admin";
import {
  getAnalytics,
  resolveRange,
  type RangePreset,
} from "@/lib/analytics";

const RangeEnum = z.enum(["day", "week", "month", "year", "all"]);

/**
 * GET /api/admin/analytics?range=week&courseId=abc
 *
 * Auth is required. Scope is derived from the admin: a superuser sees all
 * courses (or a single selected one); a courseAdmin only ever sees the
 * intersection of their assignments and any focus filter.
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rangeParam = url.searchParams.get("range") ?? "week";
  const parsedRange = RangeEnum.safeParse(rangeParam);
  const range: RangePreset = parsedRange.success ? parsedRange.data : "week";
  const focusCourseId = url.searchParams.get("courseId") || null;

  const scope = editableCourseIds(admin);
  const { from, to } = resolveRange(range);

  const result = await getAnalytics({
    courseIds: scope,
    from,
    to,
    focusCourseId,
  });

  return NextResponse.json({ range, ...result });
}
