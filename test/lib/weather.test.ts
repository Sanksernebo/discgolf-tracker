import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchCurrentWeather, weatherEmoji } from "@/lib/weather";

describe("weatherEmoji", () => {
  it("returns fallback thermometer for null", () => {
    expect(weatherEmoji(null)).toBe("🌡️");
  });

  it("returns sun for clear (0)", () => {
    expect(weatherEmoji(0)).toBe("☀️");
  });

  it("returns partly cloudy for 1..3", () => {
    for (const c of [1, 2, 3]) expect(weatherEmoji(c)).toBe("⛅");
  });

  it("returns fog for 45/48", () => {
    expect(weatherEmoji(45)).toBe("🌫️");
    expect(weatherEmoji(48)).toBe("🌫️");
  });

  it("returns rain for 51..67", () => {
    for (const c of [51, 55, 60, 67]) expect(weatherEmoji(c)).toBe("🌧️");
  });

  it("returns snow for 71..77", () => {
    expect(weatherEmoji(75)).toBe("❄️");
  });

  it("returns thunder for 95+", () => {
    expect(weatherEmoji(95)).toBe("⛈️");
    expect(weatherEmoji(99)).toBe("⛈️");
  });
});

describe("fetchCurrentWeather", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps Open-Meteo response into our shape", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            current: {
              temperature_2m: 17.3,
              wind_speed_10m: 12.4,
              precipitation: 0.2,
              weather_code: 3,
            },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;

    const w = await fetchCurrentWeather(58.3, 26.7);
    expect(w).not.toBeNull();
    expect(w!.temperatureC).toBe(17.3);
    expect(w!.windSpeedKmh).toBe(12.4);
    expect(w!.precipitationMm).toBe(0.2);
    expect(w!.weatherCode).toBe(3);
    expect(typeof w!.fetchedAt).toBe("string");
  });

  it("returns null on network failure", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;

    const w = await fetchCurrentWeather(58.3, 26.7);
    expect(w).toBeNull();
  });

  it("returns null on non-200", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("nope", { status: 500 }),
    ) as unknown as typeof fetch;

    const w = await fetchCurrentWeather(58.3, 26.7);
    expect(w).toBeNull();
  });

  it("passes lat/lng and current fields in the URL", async () => {
    const spy = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify({ current: {} }), { status: 200 }),
    );
    globalThis.fetch = spy as unknown as typeof fetch;

    await fetchCurrentWeather(58.3, 26.7);

    const call = spy.mock.calls[0]?.[0];
    expect(typeof call).toBe("string");
    const u = new URL(call as string);
    expect(u.origin + u.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(u.searchParams.get("latitude")).toBe("58.3");
    expect(u.searchParams.get("longitude")).toBe("26.7");
    expect(u.searchParams.get("current")).toContain("temperature_2m");
    expect(u.searchParams.get("current")).toContain("wind_speed_10m");
  });
});
