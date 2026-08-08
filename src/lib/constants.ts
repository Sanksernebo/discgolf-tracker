// Auto-checkout window: session is considered active while a client pings
// within this many minutes.
export const ACTIVE_WINDOW_MINUTES = 180;

// Client should re-ping the server this often (ms) while marked "on course".
export const PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// One check-in can represent a group. Cap at a sane upper bound so a
// typo in the +/- UI can't advertise "50 people on the course".
export const MAX_PARTY_SIZE = 8;

// Estonian counties, used to group courses on the map. Coordinates roughly at
// each county's center; used as fallback bubble anchors when a county has
// multiple courses.
export const ESTONIAN_COUNTIES: Record<
  string,
  { et: string; en: string; lat: number; lng: number }
> = {
  harju: { et: "Harjumaa", en: "Harju County", lat: 59.35, lng: 25.05 },
  hiiu: { et: "Hiiumaa", en: "Hiiu County", lat: 58.92, lng: 22.6 },
  ida_viru: { et: "Ida-Virumaa", en: "Ida-Viru County", lat: 59.35, lng: 27.4 },
  jarva: { et: "Järvamaa", en: "Järva County", lat: 58.9, lng: 25.5 },
  jogeva: { et: "Jõgevamaa", en: "Jõgeva County", lat: 58.75, lng: 26.4 },
  laane: { et: "Läänemaa", en: "Lääne County", lat: 58.95, lng: 23.8 },
  laane_viru: {
    et: "Lääne-Virumaa",
    en: "Lääne-Viru County",
    lat: 59.3,
    lng: 26.35,
  },
  parnu: { et: "Pärnumaa", en: "Pärnu County", lat: 58.4, lng: 24.5 },
  polva: { et: "Põlvamaa", en: "Põlva County", lat: 58.05, lng: 27.05 },
  rapla: { et: "Raplamaa", en: "Rapla County", lat: 58.95, lng: 24.7 },
  saare: { et: "Saaremaa", en: "Saare County", lat: 58.35, lng: 22.55 },
  tartu: { et: "Tartumaa", en: "Tartu County", lat: 58.4, lng: 26.7 },
  valga: { et: "Valgamaa", en: "Valga County", lat: 57.9, lng: 26.2 },
  viljandi: { et: "Viljandimaa", en: "Viljandi County", lat: 58.35, lng: 25.6 },
  voru: { et: "Võrumaa", en: "Võru County", lat: 57.85, lng: 27.05 },
};

export type CountyKey = keyof typeof ESTONIAN_COUNTIES;

export const DEFAULT_LOCALE = "et" as const;
export const LOCALES = ["et", "en"] as const;
export type Locale = (typeof LOCALES)[number];
