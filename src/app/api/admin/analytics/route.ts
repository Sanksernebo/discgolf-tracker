import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, editableCourseIds } from "@/lib/admin";
import {
  getAnalytics,
  resolveCustomRange,
  resolveRange,
  type RangePreset,
} from "@/lib/analytics";

const RangeEnum = z.enum(["day", "week", "month", "year", "all", "custom"]);

/**
 * GET /api/admin/analytics?range=week&courseId=abc
 * GET /api/admin/analytics?range=custom&from=2026-06-01&to=2026-06-30
 *
 * `custom` takes inclusive Tallinn-local days; malformed or reversed dates
 * are rejected with 400.
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
  const range = parsedRange.success ? parsedRange.data : "week";
  const focusCourseId = url.searchParams.get("courseId") || null;

  const bounds =
    range === "custom"
      ? resolveCustomRange(
          url.searchParams.get("from") ?? "",
          url.searchParams.get("to") ?? "",
        )
      : resolveRange(range satisfies RangePreset);
  if (!bounds) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  const { from, to } = bounds;
  const scope = editableCourseIds(admin);

  const result = await getAnalytics({
    courseIds: scope,
    from,
    to,
    focusCourseId,
  });

  return NextResponse.json({ range, ...result });
}
