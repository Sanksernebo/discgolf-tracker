"use client";

import dynamic from "next/dynamic";

// Load the banner client-only. It's hidden by default (checks localStorage
// on mount before showing), so there's no visible-content SSR to sacrifice.
// This also sidesteps a next-intl SSR issue on some hosts where the
// request-context lookup for `useTranslations` inside a client component
// intermittently returns ENVIRONMENT_FALLBACK during the initial render.
const CookieBanner = dynamic(
  () => import("./CookieBanner").then((m) => m.CookieBanner),
  { ssr: false },
);

export function CookieBannerLoader() {
  return <CookieBanner />;
}
