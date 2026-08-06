import { prisma } from "@/lib/prisma";

/**
 * Build a controllable in-memory cookie store that satisfies the subset of
 * Next's cookies() API that the app actually uses (get/set/delete + .value).
 * Each helper returns a fresh instance so tests can inspect what was set.
 */
export function makeCookieStore(initial: Record<string, string> = {}) {
  const map = new Map<string, { name: string; value: string }>();
  for (const [k, v] of Object.entries(initial)) {
    map.set(k, { name: k, value: v });
  }

  return {
    get(name: string) {
      return map.get(name);
    },
    set(nameOrObj: string | { name: string; value: string }, value?: string) {
      if (typeof nameOrObj === "string") {
        map.set(nameOrObj, { name: nameOrObj, value: value ?? "" });
      } else {
        map.set(nameOrObj.name, nameOrObj);
      }
    },
    delete(name: string) {
      map.delete(name);
    },
    /** Test-only inspection. */
    _dump() {
      return Object.fromEntries(
        Array.from(map.values()).map((c) => [c.name, c.value]),
      );
    },
  };
}

/** Build a JSON POST Request suitable for a route handler under test. */
export function jsonRequest(
  url: string,
  body: unknown,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Seed a course with N holes; returns the course id. */
export async function seedCourse(
  overrides: Partial<{
    nameEt: string;
    nameEn: string;
    county: string;
    city: string | null;
    latitude: number;
    longitude: number;
    holes: number;
  }> = {},
) {
  const holes = overrides.holes ?? 9;
  const course = await prisma.course.create({
    data: {
      nameEt: overrides.nameEt ?? "Test rada",
      nameEn: overrides.nameEn ?? "Test course",
      county: overrides.county ?? "harju",
      city: overrides.city ?? null,
      latitude: overrides.latitude ?? 59.4,
      longitude: overrides.longitude ?? 24.75,
      holes: {
        create: Array.from({ length: holes }, (_, i) => ({
          number: i + 1,
          par: 3,
          distance: 50 + i * 5,
        })),
      },
    },
  });
  return course.id;
}
