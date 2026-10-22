import { describe, it, expect } from "vitest";
import type { AnalyticsResult } from "@/lib/analytics";
import {
  buildExportTables,
  columnLetter,
  crc32,
  csvBytes,
  csvZip,
  exportBaseName,
  toCsv,
  toXlsx,
  zip,
  type ExportLabels,
  type ExportTable,
} from "@/lib/analytics-export";

const labels: ExportLabels = {
  summary: "Summary",
  daily: "Daily players",
  hourly: "Time of day",
  weekday: "Day of the week",
  heatmap: "Utilization heatmap",
  courses: "By course",
  metric: "Metric",
  value: "Value",
  previous: "Previous period",
  from: "From",
  to: "To",
  date: "Date",
  hour: "Hour",
  weekdayCol: "Weekday",
  course: "Course",
  players: "Players",
  checkIns: "Check-ins",
  uniqueVisitors: "Unique visitors",
  avgPartySize: "Avg party size",
  avgDurationMinutes: "Avg round (min)",
  returningPct: "Returning visitors (%)",
  activeNow: "On course now",
  weekdayNames: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const summary = {
  checkIns: 3,
  uniqueVisitors: 2,
  players: 7,
  avgPartySize: 2.3,
  avgDurationMinutes: 85,
  returningRate: 0.5,
  activeNow: 1,
};

function sample(overrides: Partial<AnalyticsResult> = {}): AnalyticsResult {
  return {
    // 2026-06-01 00:00 → 2026-06-30 23:59 Tallinn (UTC+3 in summer).
    from: "2026-05-31T21:00:00.000Z",
    to: "2026-06-30T20:59:59.999Z",
    summary,
    previousSummary: null,
    daily: [{ date: "2026-06-01", checkIns: 3, uniqueVisitors: 2, players: 7 }],
    hourly: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      checkIns: hour === 9 ? 3 : 0,
      players: hour === 9 ? 7 : 0,
    })),
    weekday: Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      checkIns: weekday === 0 ? 3 : 0,
      players: weekday === 0 ? 7 : 0,
    })),
    heatmap: Array.from({ length: 168 }, (_, i) => {
      const weekday = Math.floor(i / 24);
      const hour = i % 24;
      const hit = weekday === 0 && hour === 9;
      return { weekday, hour, checkIns: hit ? 3 : 0, players: hit ? 7 : 0 };
    }),
    courses: [
      {
        courseId: "c1",
        nameEt: "Pirita rada",
        nameEn: "Pirita course",
        checkIns: 3,
        players: 7,
        uniqueVisitors: 2,
      },
    ],
    ...overrides,
  };
}

/** Read entries back out of a stored (uncompressed) ZIP via its central directory. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true);
    const data = bytes.subarray(start, start + size);
    expect(crc32(data)).toBe(crc);
    out.set(name, dec.decode(data));
    p += 46 + nameLen;
  }
  return out;
}

describe("analytics export", () => {
  it("crc32 matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("columnLetter follows Excel's A..Z, AA.. scheme", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnLetter)).toEqual([
      "A",
      "Z",
      "AA",
      "AB",
      "AZ",
      "BA",
    ]);
  });

  it("names files after the Tallinn-local period", () => {
    expect(exportBaseName(sample())).toBe("analytics_2026-06-01_2026-06-30");
  });

  it("CSV quotes special characters and neutralises formula injection", () => {
    const table: ExportTable = {
      name: "t",
      title: "T",
      columns: ["Name", "Players"],
      rows: [
        ['Rada "A", põhi', 3],
        ["=HYPERLINK(\"x\")", -2],
        ["line\nbreak", 0],
      ],
    };
    expect(toCsv(table)).toBe(
      [
        "Name,Players",
        '"Rada ""A"", põhi",3',
        `"'=HYPERLINK(""x"")",-2`,
        '"line\nbreak",0',
      ].join("\r\n"),
    );
  });

  it("CSV bytes start with a UTF-8 BOM so Excel reads õäöü", () => {
    const bytes = csvBytes({ name: "t", title: "T", columns: ["õ"], rows: [] });
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("builds tables, leaving the previous-period column blank without a baseline", () => {
    const tables = buildExportTables(sample(), labels, "et");
    expect(tables.map((t) => t.name)).toEqual([
      "summary",
      "daily",
      "hourly",
      "weekday",
      "heatmap",
      "courses",
    ]);
    const [summaryT, , hourlyT, weekdayT, heatmapT, coursesT] = tables;
    expect(summaryT.rows[0]).toEqual(["From", "2026-06-01", ""]);
    expect(summaryT.rows).toContainEqual(["Players", 7, ""]);
    expect(summaryT.rows).toContainEqual(["Returning visitors (%)", 50, ""]);
    expect(hourlyT.rows[9]).toEqual(["09:00", 7, 3]);
    expect(weekdayT.rows[0]).toEqual(["Mon", 7, 3]);
    // Heatmap is a 7×24 matrix with the weekday label in column A.
    expect(heatmapT.columns).toHaveLength(25);
    expect(heatmapT.rows).toHaveLength(7);
    expect(heatmapT.rows[0][10]).toBe(7);
    expect(coursesT.rows).toEqual([["Pirita rada", 7, 3, 2]]);
  });

  it("fills the previous-period column when a baseline exists", () => {
    const [summaryT] = buildExportTables(
      sample({ previousSummary: { ...summary, players: 4 } }),
      labels,
      "en",
    );
    expect(summaryT.rows).toContainEqual(["Players", 7, 4]);
  });

  it("zip round-trips entries with UTF-8 names", () => {
    const enc = new TextEncoder();
    const files = unzip(
      zip([
        { name: "a.txt", data: enc.encode("hello") },
        { name: "rajad/õ.csv", data: enc.encode("x,y") },
      ]),
    );
    expect([...files.entries()]).toEqual([
      ["a.txt", "hello"],
      ["rajad/õ.csv", "x,y"],
    ]);
  });

  it("csvZip holds one CSV per table", () => {
    const files = unzip(csvZip(buildExportTables(sample(), labels, "en")));
    expect([...files.keys()]).toEqual([
      "summary.csv",
      "daily.csv",
      "hourly.csv",
      "weekday.csv",
      "heatmap.csv",
      "courses.csv",
    ]);
    expect(files.get("courses.csv")).toContain("Pirita course,7,3,2");
  });

  it("xlsx contains a workbook with one typed sheet per table", () => {
    const files = unzip(toXlsx(buildExportTables(sample(), labels, "en")));
    expect(files.has("[Content_Types].xml")).toBe(true);
    expect(files.has("_rels/.rels")).toBe(true);
    expect(files.has("xl/styles.xml")).toBe(true);
    const workbook = files.get("xl/workbook.xml")!;
    expect(workbook).toContain('<sheet name="Summary" sheetId="1" r:id="rId1"/>');
    expect(workbook).toContain('name="By course"');
    const courses = files.get("xl/worksheets/sheet6.xml")!;
    // Numbers are numeric cells, text is an inline string, header is bold.
    expect(courses).toContain('<c r="B2"><v>7</v></c>');
    expect(courses).toContain(
      '<c r="A2" t="inlineStr"><is><t xml:space="preserve">Pirita course</t></is></c>',
    );
    expect(courses).toContain('<c r="A1" s="1" t="inlineStr">');
  });

  it("xlsx sanitises, truncates and de-duplicates sheet names", () => {
    const t = (title: string): ExportTable => ({
      name: "x",
      title,
      columns: ["a"],
      rows: [],
    });
    const workbook = unzip(
      toXlsx([t("A/B: <C>"), t("a/b: <c>"), t("x".repeat(40))]),
    ).get("xl/workbook.xml")!;
    expect(workbook).toContain('name="A B  &lt;C&gt;"');
    expect(workbook).toContain('name="a b  &lt;c&gt; (2)"');
    expect(workbook).toContain(`name="${"x".repeat(31)}"`);
  });
});
