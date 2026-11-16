/**
 * Severe-weather warnings: shared, pure helpers used by the alert worker
 * (scripts/weather-alerts.ts) and by the website (/weather page and home banner).
 *
 * Sources:
 *  - Met Éireann (Republic of Ireland): https://www.met.ie/Open_Data/json/warning_IRELAND.json
 *    Each county is a FIPS code such as "EI07" (Dublin). Times are UTC ISO strings.
 *  - Met Office (Northern Ireland): RSS https://weather.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/ni
 */

export type Level = "yellow" | "orange" | "red";
export type WeatherSource = "met_eireann" | "met_office";

/** Cities we always cover, at every level (Babak's rule). Code → Persian name. */
export const WATCHED_COUNTIES: Record<string, string> = {
  EI07: "دابلین",
  EI10: "گالوی",
  EI04: "کورک",
};

/** Met Éireann county codes (FIPS 10-4) → Persian names. */
export const COUNTY_FA: Record<string, string> = {
  EI01: "کارلو",
  EI02: "کاوان",
  EI03: "کلر",
  EI04: "کورک",
  EI06: "دانگال",
  EI07: "دابلین",
  EI10: "گالوی",
  EI11: "کری",
  EI12: "کیلدر",
  EI13: "کیلکنی",
  EI14: "لیتریم",
  EI15: "لیش",
  EI16: "لیمریک",
  EI18: "لانگفورد",
  EI19: "لاوث",
  EI20: "مایو",
  EI21: "میث",
  EI22: "موناگان",
  EI23: "افالی",
  EI24: "راسکامن",
  EI25: "اسلایگو",
  EI26: "تیپرری",
  EI27: "واترفورد",
  EI29: "وست‌میث",
  EI30: "وکسفورد",
  EI31: "ویکلو",
};

/** Codes Met Éireann uses for a nationwide warning. */
const NATIONWIDE = new Set(["EI0", "EI00", "EI"]);

export const LEVEL_FA: Record<Level, { name: string; emoji: string }> = {
  yellow: { name: "زرد", emoji: "🟡" },
  orange: { name: "نارنجی", emoji: "🟠" },
  red: { name: "قرمز", emoji: "🔴" },
};

/** Warning types (as the sources name them, lower-case) → Persian. Unknown types keep the English name. */
const TYPE_FA: Record<string, string> = {
  wind: "باد شدید",
  rain: "باران شدید",
  thunderstorm: "رعد و برق و طوفان تندری",
  thunderstorms: "رعد و برق و طوفان تندری",
  "snow-ice": "برف و یخ‌زدگی",
  "snow/ice": "برف و یخ‌زدگی",
  snow: "برف",
  ice: "یخ‌زدگی",
  "low temperature": "سرمای شدید و یخبندان",
  "low-temperature": "سرمای شدید و یخبندان",
  "high temperature": "گرمای شدید",
  "high-temperature": "گرمای شدید",
  fog: "مه غلیظ",
  "coastal flooding": "آب‌گرفتگی سواحل",
  "coastal-flooding": "آب‌گرفتگی سواحل",
  "coastal wind": "باد شدید ساحلی",
};

export function typeFa(type: string): string {
  return TYPE_FA[type.trim().toLowerCase()] ?? type.trim();
}

/**
 * Types that mean "think twice before going out". A yellow warning in the watched cities needs one of
 * these: rain on its own is not enough (Babak: what matters is strong wind, or rain with wind, i.e. storms).
 */
const OUTDOOR_TYPES = new Set(["wind", "thunderstorm", "thunderstorms", "snow-ice", "snow/ice", "snow", "ice", "coastal wind"]);
/** Marine warnings (small craft, gale at sea) are not for people on land. */
const MARINE = /small craft|gale|marine|sea area|swell/i;

export function normaliseLevel(s: string): Level | null {
  const v = s.trim().toLowerCase();
  if (v === "yellow") return "yellow";
  if (v === "orange" || v === "amber") return "orange";
  if (v === "red") return "red";
  return null;
}

/** One warning, as both sources are read into. */
export interface Warning {
  source: WeatherSource;
  /** Stable id inside the source (Met Éireann numeric id, or the Met Office guid). */
  sourceId: string;
  type: string;
  level: Level;
  onset: string; // ISO
  expiry: string; // ISO
  issued: string; // ISO
  headline: string;
  description: string; // plain text
  /** County codes (Met Éireann) or ["NI"] for Northern Ireland. */
  regions: string[];
  /** Page with the official warning. */
  link: string;
}

/** Several source warnings with the same headline, level and times become one alert (Met Éireann splits wind and rain). */
export interface AlertGroup {
  key: string;
  source: WeatherSource;
  level: Level;
  types: string[];
  onset: string;
  expiry: string;
  issued: string;
  headline: string;
  description: string;
  regions: string[];
  link: string;
}

/** Small stable hash (FNV-1a), so keys and page anchors stay short and URL-safe. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Anchor of an alert on the /weather page. */
export const alertAnchor = (key: string) => `w-${key.replace(/[^a-z0-9]+/gi, "-")}`;

/** Wind first: "strong wind and heavy rain" is how a storm is described. */
const typeRank = (t: string) => ["wind", "thunderstorm", "rain"].indexOf(t.toLowerCase()) >>> 0;

export function groupWarnings(warnings: Warning[]): AlertGroup[] {
  const groups = new Map<string, Warning[]>();
  for (const w of warnings) {
    const k = [w.source, w.level, w.onset, w.expiry, w.headline.trim().toLowerCase()].join("|");
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  return [...groups.values()].map((ws) => {
    const ids = ws.map((w) => w.sourceId).sort();
    const descriptions = [...new Set(ws.map((w) => w.description.trim()).filter(Boolean))];
    return {
      key: `${ws[0].source}:${shortHash(ids.join("+"))}`,
      source: ws[0].source,
      level: ws[0].level,
      types: [...new Set(ws.map((w) => w.type))].sort((a, b) => typeRank(a) - typeRank(b)),
      onset: ws[0].onset,
      expiry: ws[0].expiry,
      issued: ws.map((w) => w.issued).sort()[0],
      headline: ws[0].headline,
      description: descriptions.join("\n\n"),
      regions: [...new Set(ws.flatMap((w) => w.regions))].sort(),
      link: ws[0].link,
    };
  });
}

export const isNationwide = (regions: string[]) => regions.some((r) => NATIONWIDE.has(r.toUpperCase()));

/**
 * Should this alert go to the channel?
 *  - Dublin, Galway, Cork (or the whole country): yellow too, when it has wind, storm or snow/ice
 *    (a yellow warning for rain alone is skipped).
 *  - Anywhere else in Ireland, and Northern Ireland: only orange (amber) and red.
 */
export function isRelevant(g: Pick<AlertGroup, "level" | "types" | "regions" | "headline">): boolean {
  if (g.types.every((t) => MARINE.test(t)) || MARINE.test(g.headline)) return false;
  if (g.level === "orange" || g.level === "red") return true;
  const watched = isNationwide(g.regions) || g.regions.some((r) => r in WATCHED_COUNTIES);
  return watched && g.types.some((t) => OUTDOOR_TYPES.has(t.trim().toLowerCase()));
}

/** Persian names of the areas: watched cities first, e.g. «دابلین، کورک، کری». */
export function areasFa(regions: string[]): string {
  if (isNationwide(regions)) return "سراسر ایرلند";
  if (regions.includes("NI")) return "ایرلند شمالی";
  const names = regions.map((r) => COUNTY_FA[r.toUpperCase()] ?? r);
  const watched = Object.values(WATCHED_COUNTIES);
  const sorted = [...new Set(names)].sort((a, b) => Number(watched.includes(b)) - Number(watched.includes(a)));
  return sorted.join("، ");
}

export function typesFa(types: string[]): string {
  const names = [...new Set(types.map(typeFa))];
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join("، ")} و ${names.at(-1)}`;
}

// ---------------------------------------------------------------------------
// Times, always in Dublin local time (Ireland and Northern Ireland share it)
// ---------------------------------------------------------------------------

const TZ = "Europe/Dublin";

function dublinParts(t: number) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(t)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export const dublinHour = (t: number) => dublinParts(t).hour;

const weekdayFmt = new Intl.DateTimeFormat("fa-IR-u-ca-gregory", { timeZone: TZ, weekday: "long" });
const dayMonthFmt = new Intl.DateTimeFormat("fa-IR-u-ca-gregory", { timeZone: TZ, day: "numeric", month: "long" });
const clockFmt = new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "۱۸:۰۰" */
export const clockFa = (iso: string) => clockFmt.format(new Date(iso));

/** Midnight at the end of a day is shown as 23:59 of that day, which reads better than "00:00 of the next day". */
function displayMoment(iso: string, isEnd: boolean): Date {
  const d = new Date(iso);
  if (isEnd) {
    const p = dublinParts(d.getTime());
    if (p.hour === 0 && p.minute === 0) return new Date(d.getTime() - 60_000);
  }
  return d;
}

/** "امروز"، "فردا"، "امشب" or the weekday, relative to now (Dublin days). */
function relativeDayFa(d: Date, now: Date): string {
  const day = dublinParts(d.getTime()).day;
  const today = dublinParts(now.getTime()).day;
  const tomorrow = dublinParts(now.getTime() + 24 * 3600_000).day;
  const hour = dublinParts(d.getTime()).hour;
  if (day === today) return hour >= 18 ? "امشب" : "امروز";
  if (day === tomorrow) return hour >= 18 ? "فردا شب" : "فردا";
  return "";
}

/** e.g. "دوشنبه ۱۷ نوامبر، ساعت ۱۸:۰۰" with "(فردا)" when it helps. */
export function whenFa(iso: string, opts: { isEnd?: boolean; now?: Date } = {}): string {
  const d = displayMoment(iso, opts.isEnd ?? false);
  const rel = opts.now ? relativeDayFa(d, opts.now) : "";
  const base = `${weekdayFmt.format(d)} ${dayMonthFmt.format(d)}، ساعت ${clockFmt.format(d)}`;
  return rel ? `${base} (${rel})` : base;
}

/** "حدود ۴ ساعت دیگر" / "حدود ۴۰ دقیقه دیگر" */
export function untilFa(iso: string, now: Date): string {
  const min = Math.round((Date.parse(iso) - now.getTime()) / 60_000);
  if (min <= 0) return "همین حالا";
  if (min < 90) return `حدود ${Math.max(5, Math.round(min / 5) * 5).toLocaleString("fa-IR")} دقیقه دیگر`;
  const h = Math.round(min / 30) / 2;
  return `حدود ${h.toLocaleString("fa-IR")} ساعت دیگر`;
}

// ---------------------------------------------------------------------------
// Reminder timing
// ---------------------------------------------------------------------------

/** Hours before onset for the "it starts soon" reminder. Babak asked for 3–4 hours; hourly runs send it 3–4 hours before. */
export const REMINDER_HOURS = 4;
/** On a day with a warning, a morning post goes out at 07:xx Dublin time. */
export const MORNING_HOUR = 7;
/** No reminders between 00:00 and 06:59 Dublin time; they move to 22:00 the evening before. */
const QUIET_START = 0;
const QUIET_END = 7;

/**
 * When the reminder should go out: onset minus 4 hours, but never at night. If that falls
 * between midnight and 07:00, it moves back to about 22:00 the evening before.
 */
export function reminderDue(onsetIso: string): number {
  let due = Date.parse(onsetIso) - REMINDER_HOURS * 3600_000;
  const h = dublinHour(due);
  if (h >= QUIET_START && h < QUIET_END) {
    const p = dublinParts(due);
    due -= ((p.hour + 2) * 60 + p.minute) * 60_000; // back to 22:00 the evening before
  }
  return due;
}

/**
 * Is a reminder needed now? Only once, only if the first post went out well before (otherwise
 * that post is itself the warning), and not after the warning has started.
 * `lookaheadMin` lets the last run of the evening send a reminder that is due shortly after it.
 */
export function reminderNeeded(
  a: { onset: string; first_posted_at: string | null; reminder_sent_at: string | null; morning_sent_at?: string | null },
  now: Date,
): boolean {
  if (a.reminder_sent_at || !a.first_posted_at) return false;
  const onset = Date.parse(a.onset);
  if (now.getTime() >= onset - 30 * 60_000) return false; // too late to be useful
  const due = reminderDue(a.onset);
  // The first post (or this morning's post) went out shortly before the due time: it already was the warning.
  const lastPost = Math.max(Date.parse(a.first_posted_at), a.morning_sent_at ? Date.parse(a.morning_sent_at) : 0);
  if (lastPost > due - 90 * 60_000) return false;
  // After 23:00 the next hourly run is the next morning, so send a reminder that is due within the hour now.
  const lookahead = dublinHour(now.getTime()) >= 23 ? 60 * 60_000 : 0;
  return now.getTime() >= due - lookahead;
}

/** Dublin calendar day (YYYY-MM-DD) of a moment. */
export const dublinDay = (t: number) => dublinParts(t).day;

/** Alerts for the 07:00 morning post: running now, or starting in the next 17 hours (that is, before about midnight). */
export function inMorningPost(a: { onset: string; expiry: string }, now: Date): boolean {
  return Date.parse(a.expiry) > now.getTime() && Date.parse(a.onset) - now.getTime() <= 17 * 3600_000;
}

export const isQuietHour = (now: Date) => {
  const h = dublinHour(now.getTime());
  return h >= QUIET_START && h < QUIET_END;
};

/** Short, practical advice. Our own words, kept separate from the official warning text. */
export function adviceFa(level: Level, types: string[]): string {
  const t = types.map((x) => x.toLowerCase());
  const tips: string[] = [];
  if (level === "red") tips.push("در هشدار قرمز تا پایان هشدار از خانه بیرون نروید و به توصیه‌های رسمی و نیروهای امدادی گوش دهید.");
  else if (level === "orange") tips.push("اگر کار ضروری ندارید، در این ساعت‌ها از خانه بیرون نروید و سفرهای غیرضروری را عقب بیندازید.");
  else tips.push("اگر کار ضروری ندارید، بیرون رفتن را به بعد از پایان هشدار موکول کنید و برای رفت‌وآمد زمان بیشتری بگذارید.");
  if (t.includes("wind") || t.includes("coastal wind")) tips.push("وسایل سبک حیاط و بالکن را محکم کنید و از کنار درخت‌ها، داربست‌ها و ساحل دور بمانید.");
  if (t.includes("rain") || t.some((x) => x.includes("flood"))) tips.push("از رانندگی و راه رفتن در آب‌گرفتگی‌ها خودداری کنید.");
  if (t.some((x) => x.includes("snow") || x.includes("ice") || x.includes("temperature"))) tips.push("مراقب یخ‌زدگی پیاده‌روها و جاده‌ها باشید.");
  if (t.some((x) => x.includes("thunder"))) tips.push("هنگام رعد و برق در فضای باز و زیر درخت نمانید.");
  return tips.join(" ");
}

export const SOURCE_NAME: Record<WeatherSource, string> = {
  met_eireann: "Met Éireann",
  met_office: "Met Office",
};

export const SOURCE_PAGE: Record<WeatherSource, string> = {
  met_eireann: "https://www.met.ie/warnings",
  met_office: "https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings",
};

/** A row of the weather_alerts table, as the website reads it. */
export interface WeatherAlert {
  key: string;
  source: WeatherSource;
  level: Level;
  types: string[];
  regions: string[];
  areas_fa: string;
  headline_en: string;
  title_fa: string;
  body_fa: string;
  onset: string;
  expiry: string;
  status: "active" | "cancelled";
  link: string;
  updated_at: string;
}

/** Alerts still to show: not expired and not cancelled (the Met Éireann licence asks that expired warnings are removed). */
export function stillActive<T extends { expiry: string; status: string }>(alerts: T[], now = new Date()): T[] {
  return alerts.filter((a) => a.status === "active" && Date.parse(a.expiry) > now.getTime());
}

export const LEVEL_ORDER: Record<Level, number> = { red: 3, orange: 2, yellow: 1 };
