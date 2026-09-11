import { prisma } from "./prisma";

/**
 * GDPR Article 17 ("right to erasure") implementation for a single device.
 *
 * We have no user accounts on the public side — every visitor is only ever
 * known by an anonymous `dg_device` cookie value. Erasing "everything about
 * this user" therefore means removing every row keyed on that deviceId:
 *   - CheckIn rows (their round history + party sizes)
 *   - IssueReport rows (their submitted feedback text)
 *   - PushSubscription rows (their push endpoint)
 *
 * Aggregate analytics stored elsewhere are unaffected because they are
 * derived counts, not personal data, once the source rows are gone.
 */
export type DeletionResult = {
  checkIns: number;
  issueReports: number;
  pushSubscriptions: number;
};

export async function deleteDeviceData(
  deviceId: string,
): Promise<DeletionResult> {
  if (!deviceId) {
    return { checkIns: 0, issueReports: 0, pushSubscriptions: 0 };
  }
  const [checkIns, issueReports, pushSubscriptions] = await prisma.$transaction(
    [
      prisma.checkIn.deleteMany({ where: { deviceId } }),
      prisma.issueReport.deleteMany({ where: { deviceId } }),
      prisma.pushSubscription.deleteMany({ where: { deviceId } }),
    ],
  );
  return {
    checkIns: checkIns.count,
    issueReports: issueReports.count,
    pushSubscriptions: pushSubscriptions.count,
  };
}

/**
 * Prune raw personal-data rows older than the retention window.
 *
 * Analytics only ever reads aggregates from CheckIn rows, so trimming the
 * long tail costs the admin panel nothing meaningful while satisfying the
 * "storage limitation" principle (GDPR Art 5(1)(e)).
 *
 * Defaults chosen conservatively:
 *   - CheckIn: 24 months (two full seasons — long enough for year-over-year
 *     comparisons; short enough to demonstrate purpose limitation).
 *   - IssueReport: 12 months once closed; open reports are kept regardless.
 *
 * Meant to be invoked from a scheduled task (cron / worker). Never called
 * from the request path.
 */
export async function pruneOldPersonalData(
  now: Date = new Date(),
  checkInMonths = 24,
  issueMonths = 12,
): Promise<{ checkIns: number; issues: number }> {
  const checkInCutoff = new Date(now);
  checkInCutoff.setMonth(checkInCutoff.getMonth() - checkInMonths);
  const issueCutoff = new Date(now);
  issueCutoff.setMonth(issueCutoff.getMonth() - issueMonths);

  const [checkIns, issues] = await prisma.$transaction([
    prisma.checkIn.deleteMany({
      where: { startedAt: { lt: checkInCutoff } },
    }),
    prisma.issueReport.deleteMany({
      where: { status: "closed", createdAt: { lt: issueCutoff } },
    }),
  ]);
  return { checkIns: checkIns.count, issues: issues.count };
}
