"use client";

import dynamic from "next/dynamic";

export type CourseMarker = {
  id: string;
  name: string;
  county: string;
  countyLabel: string;
  city: string | null;
  lat: number;
  lng: number;
  holeCount: number;
  activeCount: number;
};

const MapInner = dynamic(() => import("./MapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
  ),
});

export function EstoniaMap({
  courses,
  locale,
}: {
  courses: CourseMarker[];
  locale: string;
}) {
  return <MapInner courses={courses} locale={locale} />;
}
