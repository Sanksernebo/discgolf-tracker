import { getTranslations } from "next-intl/server";
import { getDeviceId } from "@/lib/device";
import { getActiveCheckInForDevice } from "@/lib/traffic";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { ESTONIAN_COUNTIES } from "@/lib/constants";

/**
 * Shortcut card shown at the top of the home page when the current device
 * has an active check-in. One-tap jump back to the course the user is
 * currently on, so returning to the app after locking the phone doesn't
 * mean re-scrolling the map to find the course.
 *
 * Renders nothing when there's no cookie, no active session, or the
 * session's course has since been deleted.
 */
export async function ActiveCheckInBanner({ locale }: { locale: string }) {
  const deviceId = await getDeviceId();
  if (!deviceId) return null;

  const active = await getActiveCheckInForDevice(deviceId);
  if (!active) return null;

  const course = await prisma.course.findUnique({
    where: { id: active.courseId },
    select: {
      id: true,
      nameEt: true,
      nameEn: true,
      county: true,
      city: true,
    },
  });
  if (!course) return null;

  const t = await getTranslations();
  const name = locale === "en" ? course.nameEn : course.nameEt;
  const countyLabel =
    ESTONIAN_COUNTIES[course.county]?.[locale === "en" ? "en" : "et"] ??
    course.county;

  return (
    <Link
      href={`/course/${course.id}`}
      className="group rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between gap-3 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition min-h-11"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white text-lg flex-shrink-0"
        >
          ⛳
        </span>
        <div className="min-w-0">
          <div className="text-xs uppercase text-emerald-700 dark:text-emerald-300 font-medium">
            {t("home.currentlyAt")}
          </div>
          <div className="font-semibold text-emerald-900 dark:text-emerald-100 truncate">
            {name}
          </div>
          <div className="text-xs text-emerald-700/80 dark:text-emerald-300/80 truncate">
            {countyLabel}
            {course.city ? ` · ${course.city}` : ""}
            {active.partySize > 1
              ? ` · ${t("course.partyOf", { count: active.partySize })}`
              : ""}
          </div>
        </div>
      </div>
      <span
        aria-hidden
        className="text-emerald-700 dark:text-emerald-300 text-2xl group-hover:translate-x-0.5 transition-transform flex-shrink-0"
      >
        →
      </span>
    </Link>
  );
}
