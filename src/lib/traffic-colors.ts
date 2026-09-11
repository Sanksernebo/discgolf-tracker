/**
 * Traffic-color buckets used by the Estonia map bubbles AND the legend.
 * Keep both in sync by importing from this one place.
 *
 * Buckets are inclusive-max: a course with `activeCount` in [0, max] uses
 * the bucket's color. Add a bucket at the top of the array and adjust
 * `max` if the buckets ever change.
 */
export type TrafficBucket = {
  key: "free" | "light" | "moderate" | "busy";
  /** Highest activeCount that still falls in this bucket (Infinity = catch-all). */
  max: number;
  /** Hex color for the marker (Tailwind emerald/amber/orange/red 500). */
  color: string;
};

export const TRAFFIC_BUCKETS: TrafficBucket[] = [
  { key: "free", max: 0, color: "#10b981" },
  { key: "light", max: 2, color: "#f59e0b" },
  { key: "moderate", max: 5, color: "#f97316" },
  { key: "busy", max: Infinity, color: "#ef4444" },
];

export function colorForTraffic(count: number): string {
  for (const bucket of TRAFFIC_BUCKETS) {
    if (count <= bucket.max) return bucket.color;
  }
  // Unreachable — the last bucket has max=Infinity — but keeps TS happy.
  return TRAFFIC_BUCKETS[TRAFFIC_BUCKETS.length - 1].color;
}
