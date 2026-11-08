"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { CourseMarker } from "@/components/map/EstoniaMap";

export function CourseSearch({ courses }: { courses: CourseMarker[] }) {
  const t = useTranslations("home");
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();

    if (!search) return [];

    return courses
      .filter((course) => {
        const searchableText = [
          course.name,
          course.city ?? "",
          course.countyLabel,
          course.county,
        ]
          .join(" ")
          .toLocaleLowerCase();

        return searchableText.includes(search);
      })
      .slice(0, 8);
  }, [courses, query]);

  const hasQuery = query.trim().length > 0;

  return (
    <section className="w-full" aria-label={t("searchLabel")}>
      <label htmlFor="course-search" className="mb-2 block text-sm font-medium">
        {t("searchLabel")}
      </label>

      <input
        id="course-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        autoComplete="off"
        className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
      />

      {hasQuery && (
        <div className="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          {results.length > 0 ? (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {results.map((course) => (
                <li key={course.id}>
                  <Link
                    href={`/course/${course.id}`}
                    className="block px-4 py-3 transition hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {course.name}
                    </div>
                    <div className="mt-0.5 text-sm text-neutral-500">
                      {[course.city, course.countyLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-neutral-500">
              {t("searchNoResults")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
