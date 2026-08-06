"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./CourseMiniMapInner"), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
  ),
});

export function CourseMiniMap(props: {
  lat: number;
  lng: number;
  name: string;
}) {
  return <Inner {...props} />;
}
