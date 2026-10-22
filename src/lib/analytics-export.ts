import type { AnalyticsResult } from "./analytics";

/**
 * Analytics export — turns an AnalyticsResult into downloadable files.
 *
 * Everything here is pure (no DOM, no Prisma) so it runs in the browser on
 * the data the dashboard already fetched, and is unit-testable in Node.
 *
 * Formats are built by hand rather than pulling in a spreadsheet library:
 * CSV is trivial, and XLSX is just a ZIP of a few XML parts. The ZIP writer
 * only "stores" (no compression), which keeps it tiny; analytics exports are
 * a few KB, so the size cost is irrelevant.
 */

export type Cell = string | number;

export type ExportTable = {
  /** File-name stem, e.g. "daily" → daily.csv. ASCII only. */
  name: string;
  /** Human-readable sheet title (Excel caps sheet names at 31 chars). */
  title: string;
  columns: string[];
  rows: Cell[][];
};

/** Translated strings used for headers and row labels. */
export type ExportLabels = {
  summary: string;
  daily: string;
  hourly: string;
  weekday: string;
  heatmap: string;
  courses: string;
  metric: string;
  value: string;
  previous: string;
  from: string;
  to: string;
  date: string;
  hour: string;
  weekdayCol: string;
  course: string;
  players: string;
  checkIns: string;
  uniqueVisitors: string;
  avgPartySize: string;
  avgDurationMinutes: string;
  returningPct: string;
  activeNow: string;
  /** Monday-first weekday names. */
  weekdayNames: string[];
};

const TZ = "Europe/Tallinn";

/** YYYY-MM-DD of an ISO instant, in the app's local timezone. */
export function localDay(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Download file-name stem shared by every format, e.g. analytics_2026-06-01_2026-06-30. */
export function exportBaseName(data: Pick<AnalyticsResult, "from" | "to">): string {
  return `analytics_${localDay(data.from)}_${localDay(data.to)}`;
}

/* -------------------------------------------------------------------------- */
/*                                   Tables                                   */
/* -------------------------------------------------------------------------- */

export function summaryTable(
  data: AnalyticsResult,
  l: ExportLabels,
): ExportTable {
  const cur = data.summary;
  const prev = data.previousSummary;
  const metric = (
    label: string,
    pick: (s: AnalyticsResult["summary"]) => number,
  ): Cell[] => [label, pick(cur), prev ? pick(prev) : ""];
  const pct = (r: number) => Math.round(r * 1000) / 10;
  return {
    name: "summary",
    title: l.summary,
    columns: [l.metric, l.value, l.previous],
    rows: [
      [l.from, localDay(data.from), ""],
      [l.to, localDay(data.to), ""],
      metric(l.players, (s) => s.players),
      metric(l.checkIns, (s) => s.checkIns),
      metric(l.uniqueVisitors, (s) => s.uniqueVisitors),
      metric(l.avgPartySize, (s) => s.avgPartySize),
      metric(l.avgDurationMinutes, (s) => s.avgDurationMinutes),
      metric(l.returningPct, (s) => pct(s.returningRate)),
      // "On course now" is a live count, not a period total — no comparison.
      [l.activeNow, cur.activeNow, ""],
    ],
  };
}

export function dailyTable(data: AnalyticsResult, l: ExportLabels): ExportTable {
  return {
    name: "daily",
    title: l.daily,
    columns: [l.date, l.players, l.checkIns, l.uniqueVisitors],
    rows: data.daily.map((d) => [d.date, d.players, d.checkIns, d.uniqueVisitors]),
  };
}

export function hourlyTable(data: AnalyticsResult, l: ExportLabels): ExportTable {
  return {
    name: "hourly",
    title: l.hourly,
    columns: [l.hour, l.players, l.checkIns],
    rows: data.hourly.map((d) => [
      `${String(d.hour).padStart(2, "0")}:00`,
      d.players,
      d.checkIns,
    ]),
  };
}

export function weekdayTable(data: AnalyticsResult, l: ExportLabels): ExportTable {
  return {
    name: "weekday",
    title: l.weekday,
    columns: [l.weekdayCol, l.players, l.checkIns],
    rows: data.weekday.map((d) => [
      l.weekdayNames[d.weekday] ?? String(d.weekday),
      d.players,
      d.checkIns,
    ]),
  };
}

/** Heatmap as a weekday × hour matrix of players — how it reads in a spreadsheet. */
export function heatmapTable(data: AnalyticsResult, l: ExportLabels): ExportTable {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const c of data.heatmap) grid[c.weekday][c.hour] = c.players;
  return {
    name: "heatmap",
    title: l.heatmap,
    columns: [
      l.weekdayCol,
      ...Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`),
    ],
    rows: grid.map((row, w) => [l.weekdayNames[w] ?? String(w), ...row]),
  };
}

export function coursesTable(
  data: AnalyticsResult,
  l: ExportLabels,
  locale: string,
): ExportTable {
  return {
    name: "courses",
    title: l.courses,
    columns: [l.course, l.players, l.checkIns, l.uniqueVisitors],
    rows: data.courses.map((c) => [
      locale === "en" ? c.nameEn : c.nameEt,
      c.players,
      c.checkIns,
      c.uniqueVisitors,
    ]),
  };
}

export function buildExportTables(
  data: AnalyticsResult,
  l: ExportLabels,
  locale: string,
): ExportTable[] {
  return [
    summaryTable(data, l),
    dailyTable(data, l),
    hourlyTable(data, l),
    weekdayTable(data, l),
    heatmapTable(data, l),
    coursesTable(data, l, locale),
  ];
}

/* -------------------------------------------------------------------------- */
/*                                    CSV                                     */
/* -------------------------------------------------------------------------- */

/**
 * Spreadsheet apps execute cells starting with these as formulas. Course
 * names are admin-entered, so neutralise them (OWASP "CSV injection").
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(v: Cell): string {
  if (typeof v === "number") return String(v);
  const s = FORMULA_PREFIX.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with CRLF line endings. */
export function toCsv(table: ExportTable): string {
  return [table.columns, ...table.rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/**
 * UTF-8 bytes with a BOM — without it Excel opens UTF-8 CSVs as the system
 * codepage and mangles õ/ä/ö/ü.
 */
export function csvBytes(table: ExportTable): Uint8Array {
  return utf8(`﻿${toCsv(table)}\r\n`);
}

/* -------------------------------------------------------------------------- */
/*                                    ZIP                                     */
/* -------------------------------------------------------------------------- */

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP (stored, no compression) — enough for CSV bundles and XLSX. */
export function zip(
  files: { name: string; data: Uint8Array }[],
  date = new Date(),
): Uint8Array {
  const dosTime =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = utf8(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // flags: UTF-8 names
    lv.setUint16(8, 0, true); // method: store
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    // extra len, comment len, disk no., internal/external attrs: all 0
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, f.data);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory signature
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

/** One CSV per table, bundled as a ZIP. */
export function csvZip(tables: ExportTable[]): Uint8Array {
  return zip(tables.map((t) => ({ name: `${t.name}.csv`, data: csvBytes(t) })));
}

/* -------------------------------------------------------------------------- */
/*                                    XLSX                                    */
/* -------------------------------------------------------------------------- */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Strip control chars XML 1.0 can't represent.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnLetter(index: number): string {
  let s = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 chars. */
function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Sheet";
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

function sheetXml(table: ExportTable): string {
  const rows = [table.columns, ...table.rows].map((row, r) => {
    const cells = row.map((v, c) => {
      const ref = `${columnLetter(c)}${r + 1}`;
      // Style 1 = bold, applied to the header row.
      const style = r === 0 ? ' s="1"' : "";
      if (typeof v === "number" && Number.isFinite(v)) {
        return `<c r="${ref}"${style}><v>${v}</v></c>`;
      }
      return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(v))}</t></is></c>`;
    });
    return `<row r="${r + 1}">${cells.join("")}</row>`;
  });
  // Width roughly fits the longest value in each column.
  const widths = table.columns.map((_, c) =>
    Math.min(
      60,
      Math.max(8, ...[table.columns, ...table.rows].map((row) => String(row[c] ?? "").length + 2)),
    ),
  );
  const cols = widths
    .map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`)
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Freeze the header row.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `</worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** An Excel workbook with one sheet per table. */
export function toXlsx(tables: ExportTable[]): Uint8Array {
  const used = new Set<string>();
  const names = tables.map((t) => sheetName(t.title, used));

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    tables
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join("") +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>` +
    names
      .map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("") +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    tables
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join("") +
    `<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  return zip([
    { name: "[Content_Types].xml", data: utf8(contentTypes) },
    { name: "_rels/.rels", data: utf8(rootRels) },
    { name: "xl/workbook.xml", data: utf8(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(workbookRels) },
    { name: "xl/styles.xml", data: utf8(STYLES_XML) },
    ...tables.map((t, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: utf8(sheetXml(t)),
    })),
  ]);
}
