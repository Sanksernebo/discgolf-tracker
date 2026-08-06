export type Weather = {
  temperatureC: number | null;
  windSpeedKmh: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  fetchedAt: string;
};

/** Fetch current weather from Open-Meteo (no API key required). */
export async function fetchCurrentWeather(
  lat: number,
  lng: number,
): Promise<Weather | null> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set(
    "current",
    "temperature_2m,wind_speed_10m,precipitation,weather_code",
  );
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("wind_speed_unit", "kmh");

  try {
    const res = await fetch(url.toString(), {
      // Cache 10 min server-side; Open-Meteo is generous but be polite.
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        wind_speed_10m?: number;
        precipitation?: number;
        weather_code?: number;
      };
    };
    const c = data.current;
    if (!c) return null;
    return {
      temperatureC: c.temperature_2m ?? null,
      windSpeedKmh: c.wind_speed_10m ?? null,
      precipitationMm: c.precipitation ?? null,
      weatherCode: c.weather_code ?? null,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function weatherEmoji(code: number | null): string {
  if (code == null) return "🌡️";
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}
