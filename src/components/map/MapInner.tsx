"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ESTONIAN_COUNTIES } from "@/lib/constants";
import type { CourseMarker } from "./EstoniaMap";

const ESTONIA_CENTER: [number, number] = [58.7, 25.5];
const ESTONIA_ZOOM = 7;

/** Reactively fly the map when the county selection changes. */
function ViewController({
  target,
  zoom,
}: {
  target: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(target, zoom, { duration: 0.6 });
  }, [map, target, zoom]);
  return null;
}

function colorForTraffic(count: number): string {
  if (count === 0) return "#10b981"; // emerald-500
  if (count <= 2) return "#f59e0b"; // amber-500
  if (count <= 5) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}

export default function MapInner({
  courses,
  locale,
}: {
  courses: CourseMarker[];
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const rawCounty = searchParams.get("county");
  const selectedCounty =
    rawCounty && ESTONIAN_COUNTIES[rawCounty] ? rawCounty : null;

  const setSelectedCounty = useCallback(
    (county: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (county) next.set("county", county);
      else next.delete("county");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const countyAggregates = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; lat: number; lng: number; courses: number; active: number }
    >();
    for (const c of courses) {
      const meta = ESTONIAN_COUNTIES[c.county];
      const label =
        meta?.[locale === "en" ? "en" : "et"] ?? c.countyLabel ?? c.county;
      const lat = meta?.lat ?? c.lat;
      const lng = meta?.lng ?? c.lng;
      const existing = map.get(c.county);
      if (existing) {
        existing.courses += 1;
        existing.active += c.activeCount;
      } else {
        map.set(c.county, {
          key: c.county,
          label,
          lat,
          lng,
          courses: 1,
          active: c.activeCount,
        });
      }
    }
    return Array.from(map.values());
  }, [courses, locale]);

  const view = useMemo(() => {
    if (!selectedCounty) {
      return { center: ESTONIA_CENTER, zoom: ESTONIA_ZOOM };
    }
    const meta = ESTONIAN_COUNTIES[selectedCounty];
    if (meta) return { center: [meta.lat, meta.lng] as [number, number], zoom: 10 };
    const first = courses.find((c) => c.county === selectedCounty);
    if (first) return { center: [first.lat, first.lng] as [number, number], zoom: 10 };
    return { center: ESTONIA_CENTER, zoom: ESTONIA_ZOOM };
  }, [selectedCounty, courses]);

  const visibleCourses = selectedCounty
    ? courses.filter((c) => c.county === selectedCounty)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-neutral-500">
          {selectedCounty ? t("map.clickCourse") : t("map.clickCounty")}
        </div>
        {selectedCounty && (
          <button
            type="button"
            onClick={() => setSelectedCounty(null)}
            className="px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            ← {t("map.backToEstonia")}
          </button>
        )}
      </div>
      <div className="h-[520px] w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <MapContainer
          center={ESTONIA_CENTER}
          zoom={ESTONIA_ZOOM}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ViewController target={view.center} zoom={view.zoom} />

          {!selectedCounty &&
            countyAggregates.map((c) => {
              const radius = 12 + Math.min(c.courses, 6) * 3;
              const color = colorForTraffic(c.active);
              return (
                <CircleMarker
                  key={c.key}
                  center={[c.lat, c.lng]}
                  radius={radius}
                  pathOptions={{
                    color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.55,
                  }}
                  eventHandlers={{
                    click: () => setSelectedCounty(c.key),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{c.label}</div>
                      <div className="text-neutral-600">
                        {t("map.countyCourses", { count: c.courses })}
                      </div>
                      <div className="text-neutral-600">
                        {t("map.playersHere", { count: c.active })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCounty(c.key)}
                        className="mt-2 text-emerald-600 hover:underline"
                      >
                        {t("map.clickCounty")} →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

          {selectedCounty &&
            visibleCourses.map((c) => {
              const radius = 10 + Math.min(c.activeCount, 8) * 2;
              const color = colorForTraffic(c.activeCount);
              return (
                <CircleMarker
                  key={c.id}
                  center={[c.lat, c.lng]}
                  radius={radius}
                  pathOptions={{
                    color,
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.65,
                  }}
                  eventHandlers={{
                    click: () => router.push(`/course/${c.id}`),
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{c.name}</div>
                      {c.city && (
                        <div className="text-neutral-600">{c.city}</div>
                      )}
                      <div className="text-neutral-600">
                        {t("map.playersHere", { count: c.activeCount })}
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push(`/course/${c.id}`)}
                        className="mt-2 text-emerald-600 hover:underline"
                      >
                        →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
        </MapContainer>
      </div>

      {selectedCounty && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {visibleCourses.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => router.push(`/course/${c.id}`)}
                className="w-full text-left rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
              >
                <div className="font-medium">{c.name}</div>
                {c.city && (
                  <div className="text-xs text-neutral-500">{c.city}</div>
                )}
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: colorForTraffic(c.activeCount) }}
                  />
                  <span className="text-neutral-600 dark:text-neutral-300">
                    {t("map.playersHere", { count: c.activeCount })}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
