import { getTranslations } from "next-intl/server";
import { getDeviceId } from "@/lib/device";
import { getActiveCheckInForDevice } from "@/lib/traffic";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";

/**
 * Compact pill rendered UNDER the Estonia map that jumps back to whichever
 * course the current device is checked in on. Complements the full-width
 * `ActiveCheckInBanner` at the top of the page: the banner is what a user
 * sees on first paint, this pill is what they see once they've scrolled the
 * map into view and would otherwise have to scroll back up to leave.
 *
 * Renders nothing when there is no device cookie, no active session, or the
 * session's course has since been deleted — matching the banner's
 * self-hiding contract so the map area stays clean for anyone not on a
 * course right now.
 */
export async function JumpToCheckInShortcut({ locale }: { locale: string }) {
  const deviceId = await getDeviceId();
  if (!deviceId) return null;

  const active = await getActiveCheckInForDevice(deviceId);
  if (!active) return null;

  const course = await prisma.course.findUnique({
    where: { id: active.courseId },
    select: { id: true, nameEt: true, nameEn: true },
  });
  if (!course) return null;

  const t = await getTranslations("home");
  const name = locale === "en" ? course.nameEn : course.nameEt;

  return (
    <div className="flex justify-center">
      <Link
        href={`/course/${course.id}`}
        aria-label={t("jumpToSession", { name })}
        className="group inline-flex items-center gap-2 rounded-full border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition min-h-11"
      >
        <span aria-hidden>⛳</span>
        <span>{t("jumpToSession", { name })}</span>
        <span
          aria-hidden
          className="group-hover:translate-x-0.5 transition-transform"
        >
          →
        </span>
      </Link>
    </div>
  );
}
