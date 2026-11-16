/** Reads the official warning feeds into the shared Warning shape (see src/lib/weather.ts). */
import Parser from "rss-parser";
import { normaliseLevel, type Warning } from "../../src/lib/weather";

export const MET_EIREANN_URL = "https://www.met.ie/Open_Data/json/warning_IRELAND.json";
export const MET_OFFICE_NI_URL = "https://weather.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/ni";

const UA = "IrelandNewsPersian/1.0 (weather warnings)";

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const toIso = (s: string) => new Date(s).toISOString();

interface MetEireannRaw {
  id: number | string;
  capId?: string;
  type: string;
  severity?: string;
  certainty?: string;
  level: string;
  issued: string;
  updated?: string;
  onset: string;
  expiry: string;
  headline: string;
  description: string;
  status?: string;
  regions: string[];
}

/** Met Éireann JSON → warnings. Throws if the shape is not what we expect, so a broken feed never cancels alerts. */
export function parseMetEireann(json: unknown): Warning[] {
  if (!Array.isArray(json)) throw new Error("Met Éireann feed is not an array");
  const out: Warning[] = [];
  for (const raw of json as MetEireannRaw[]) {
    const level = normaliseLevel(String(raw.level ?? ""));
    if (!level || !raw.onset || !raw.expiry || !Array.isArray(raw.regions)) continue;
    if (raw.status && !/warning/i.test(raw.status)) continue; // e.g. advisories or tests
    out.push({
      source: "met_eireann",
      sourceId: String(raw.id),
      type: String(raw.type ?? ""),
      level,
      onset: toIso(raw.onset),
      expiry: toIso(raw.expiry),
      issued: toIso(raw.updated || raw.issued || raw.onset),
      headline: String(raw.headline ?? "").trim(),
      description: stripHtml(String(raw.description ?? "")),
      regions: raw.regions.map((r) => String(r).toUpperCase()),
      link: "https://www.met.ie/warnings",
    });
  }
  return out;
}

export async function fetchMetEireann(): Promise<Warning[]> {
  const res = await fetch(MET_EIREANN_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Met Éireann: HTTP ${res.status}`);
  return parseMetEireann(await res.json());
}

// ---------------------------------------------------------------------------
// Met Office (Northern Ireland) RSS
// ---------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** UK local time (Europe/London) → UTC ms. */
export function ukLocalToUtc(year: number, month: number, day: number, hh: number, mm: number): number {
  const guess = Date.UTC(year, month, day, hh, mm);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(guess)
      .map((x) => [x.type, x.value]),
  );
  const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return guess - (shown - guess);
}

/** "1500 Thu 21 Nov" → ISO, choosing the year that puts the date nearest to `now`. */
function parseUkMoment(hhmm: string, day: string, mon: string, now: Date): string | null {
  const m = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
  if (m < 0) return null;
  const hh = Number(hhmm.slice(0, 2));
  const mm = Number(hhmm.slice(2, 4));
  const y = now.getUTCFullYear();
  const candidates = [y - 1, y, y + 1].map((yy) => ukLocalToUtc(yy, m, Number(day), hh, mm));
  const best = candidates.sort((a, b) => Math.abs(a - now.getTime()) - Math.abs(b - now.getTime()))[0];
  return new Date(best).toISOString();
}

const VALID_RE = /valid\s+from\s+(\d{4})\s+\w{3}\s+(\d{1,2})\s+(\w{3,9})\s+to\s+(\d{4})\s+\w{3}\s+(\d{1,2})\s+(\w{3,9})/i;
const TITLE_RE = /(yellow|amber|red)\s+warning\s+of\s+(.+?)\s+affecting/i;

export function parseMetOfficeItems(
  items: { title?: string; contentSnippet?: string; content?: string; link?: string; guid?: string; isoDate?: string }[],
  now = new Date(),
): Warning[] {
  const out: Warning[] = [];
  for (const it of items) {
    const title = (it.title ?? "").trim();
    const text = stripHtml(it.content ?? it.contentSnippet ?? "");
    const t = TITLE_RE.exec(title) ?? TITLE_RE.exec(text);
    const v = VALID_RE.exec(text) ?? VALID_RE.exec(title);
    const level = t ? normaliseLevel(t[1]) : null;
    if (!t || !v || !level) {
      if (title) console.warn(`  Met Office: could not read "${title.slice(0, 100)}"`);
      continue;
    }
    const onset = parseUkMoment(v[1], v[2], v[3], now);
    const expiry = parseUkMoment(v[4], v[5], v[6], now);
    if (!onset || !expiry) continue;
    for (const type of t[2].split(/\s*(?:,|\band\b)\s*/i).filter(Boolean)) {
      out.push({
        source: "met_office",
        sourceId: `${it.guid ?? it.link ?? title}#${type.toLowerCase()}`,
        type: type.toLowerCase() === "snow" || type.toLowerCase() === "ice" ? "snow-ice" : type.replace(/s$/i, "").toLowerCase() === "thunderstorm" ? "thunderstorm" : type,
        level,
        onset,
        expiry,
        issued: it.isoDate ?? now.toISOString(),
        headline: title,
        description: text,
        regions: ["NI"],
        link: it.link || "https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings",
      });
    }
  }
  return out;
}

export async function fetchMetOfficeNI(): Promise<Warning[]> {
  const res = await fetch(MET_OFFICE_NI_URL, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Met Office: HTTP ${res.status}`);
  const feed = await new Parser().parseString(await res.text());
  return parseMetOfficeItems(feed.items ?? []);
}
