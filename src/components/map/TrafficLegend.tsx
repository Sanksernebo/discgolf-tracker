import { getTranslations } from "next-intl/server";
import { TRAFFIC_BUCKETS } from "@/lib/traffic-colors";

/**
 * Tiny legend explaining what the bubble colors on the Estonia map mean.
 * Renders as a horizontal row of colored dots with labels, wraps on
 * narrow viewports. Uses the same TRAFFIC_BUCKETS source as MapInner so
 * the colors are guaranteed in sync.
 */
export async function TrafficLegend() {
  const t = await getTranslations("legend");
  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600 dark:text-neutral-400"
    >
      <span className="font-medium text-neutral-500 dark:text-neutral-400">
        {t("label")}:
      </span>
      {TRAFFIC_BUCKETS.map((bucket) => (
        <span key={bucket.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            style={{ background: bucket.color }}
          />
          <span>{t(bucket.key)}</span>
        </span>
      ))}
    </div>
  );
}
