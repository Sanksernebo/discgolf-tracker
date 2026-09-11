import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDeviceId } from "@/lib/device";
import { deleteDeviceData } from "@/lib/data-deletion";

/**
 * POST /api/me/delete — GDPR right-to-erasure endpoint for the anonymous
 * public visitor. Requires no auth: possession of the `dg_device` cookie
 * IS the identifier, and only the browser that holds it can trigger the
 * deletion of that device's data.
 *
 * The response also clears the cookie so the next request starts a fresh
 * device identity, which the user can then either avoid creating (by not
 * checking in again) or accept as a clean slate.
 */
export async function POST() {
  const deviceId = await getDeviceId();
  const result = deviceId
    ? await deleteDeviceData(deviceId)
    : { checkIns: 0, issueReports: 0, pushSubscriptions: 0 };

  const store = await cookies();
  store.delete("dg_device");

  return NextResponse.json({ ok: true, deleted: result });
}
