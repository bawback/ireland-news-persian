/** Telegram texts for weather alerts. Times and places come from code, never from the model. */
import { isolateForSocial } from "../../src/lib/bidi";
import {
  LEVEL_FA,
  SOURCE_NAME,
  WATCHED_COUNTIES,
  adviceFa,
  isNationwide,
  typesFa,
  untilFa,
  whenFa,
  type Level,
  type WeatherSource,
} from "../../src/lib/weather";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** HTML-safe Persian text with every English run isolated (the line mark is added once per line by rtl()). */
const fa = (s: string) => esc(isolateForSocial(s)).replace(/^\u200f/gm, "");
/** Starts every line with a right-to-left mark, so lines that begin with an emoji or a tag stay RTL. */
const rtl = (lines: string[]) =>
  lines
    .join("\n")
    .split("\n")
    .map((l) => (!l.trim() || l.startsWith("\u200f") || l.startsWith("#") ? l : `\u200f${l}`))
    .join("\n");

export interface AlertForText {
  source: WeatherSource;
  level: Level;
  types: string[];
  regions: string[];
  areas_fa: string;
  title_fa: string;
  body_fa: string;
  onset: string;
  expiry: string;
}

export const fallbackTitle = (a: Pick<AlertForText, "level" | "types" | "areas_fa">) =>
  `هشدار ${LEVEL_FA[a.level].name} ${typesFa(a.types)} برای ${a.areas_fa}`;

function hashtags(a: AlertForText): string {
  const tags = ["#هشدار_هواشناسی", "#هواشناسی_ایرلند"];
  if (a.regions.includes("NI")) tags.push("#ایرلند_شمالی");
  for (const [code, name] of Object.entries(WATCHED_COUNTIES)) if (a.regions.includes(code) || isNationwide(a.regions)) tags.push(`#${name}`);
  return tags.join(" ");
}

function timeLines(a: AlertForText, now: Date): string[] {
  const started = Date.parse(a.onset) <= now.getTime();
  return [
    started ? `⏱ <b>شروع:</b> ${fa(whenFa(a.onset, { now }))}، از همین حالا فعال است` : `⏱ <b>شروع:</b> ${fa(whenFa(a.onset, { now }))}`,
    `⏱ <b>پایان:</b> ${fa(whenFa(a.expiry, { isEnd: true, now }))}`,
    "(همه ساعت‌ها به وقت ایرلند)",
  ];
}

function footer(a: AlertForText, link: string): string[] {
  return [`منبع: ${fa(`هواشناسی رسمی ${a.source === "met_office" ? "بریتانیا" : "ایرلند"} (${SOURCE_NAME[a.source]})`)}`, `🔗 <a href="${link}">همه هشدارهای فعال در سایت</a>`, "", hashtags(a)];
}

/** The first post about a warning (also used, with a header, when it is updated). */
export function alertPostText(a: AlertForText, link: string, now: Date, update?: string): string {
  const head = update ? [`🔄 <b>به‌روزرسانی هشدار هواشناسی</b>`, fa(update), ""] : [];
  return rtl([
    ...head,
    `${LEVEL_FA[a.level].emoji} <b>${fa(a.title_fa || fallbackTitle(a))}</b>`,
    `📍 <b>${fa(a.areas_fa)}</b>`,
    "",
    ...timeLines(a, now),
    "",
    ...(a.body_fa ? [fa(a.body_fa), ""] : []),
    `✅ <b>توصیه:</b> ${fa(adviceFa(a.level, a.types))}`,
    "",
    ...footer(a, link),
  ]);
}

/** The reminder, a few hours before the warning starts. Sent as a reply to the first post. */
export function reminderText(a: AlertForText, link: string, now: Date): string {
  return rtl([
    `⏰ <b>یادآوری: ${fa(fallbackTitle(a))}</b>`,
    "",
    `${LEVEL_FA[a.level].emoji} ${fa(`این هشدار ${untilFa(a.onset, now)} شروع می‌شود.`)}`,
    "",
    ...timeLines(a, now),
    "",
    `✅ ${fa(adviceFa(a.level, a.types))}`,
    "",
    ...footer(a, link),
  ]);
}

/** What changed, in one Persian sentence, or null if nothing that matters changed. */
export function describeChange(
  before: { level: Level; onset: string; expiry: string; regions: string[] },
  after: { level: Level; onset: string; expiry: string; regions: string[]; areas_fa: string },
): string | null {
  const parts: string[] = [];
  const order = { yellow: 1, orange: 2, red: 3 };
  if (before.level !== after.level) {
    parts.push(
      `سطح هشدار از ${LEVEL_FA[before.level].name} به ${LEVEL_FA[after.level].name} ${order[after.level] > order[before.level] ? "بالا رفت" : "پایین آمد"}.`,
    );
  }
  const moved = (x: string, y: string) => Math.abs(Date.parse(x) - Date.parse(y)) >= 15 * 60_000;
  if (moved(before.onset, after.onset) || moved(before.expiry, after.expiry)) parts.push("ساعت شروع یا پایان هشدار تغییر کرد.");
  if (after.regions.some((r) => !before.regions.includes(r))) parts.push(`منطقه‌های هشدار بیشتر شد: ${after.areas_fa}.`);
  return parts.length ? parts.join(" ") : null;
}

export const endedNote = "\u200f✔️ <b>این هشدار به پایان رسیده است.</b>";
export const cancelledNote = "\u200f✖️ <b>این هشدار از سوی اداره هواشناسی لغو شد.</b>";

/** The 07:00 post on a day with warnings: every alert of the day in one message. */
export function morningText(alerts: AlertForText[], link: string, now: Date): string {
  const blocks = alerts.map((a) => {
    const started = Date.parse(a.onset) <= now.getTime();
    return [
      `${LEVEL_FA[a.level].emoji} <b>${fa(fallbackTitle(a))}</b>`,
      started ? `⏱ ${fa(`فعال است تا ${whenFa(a.expiry, { isEnd: true, now })}`)}` : `⏱ ${fa(`از ${whenFa(a.onset, { now })}`)}`,
      ...(started ? [] : [`⏱ ${fa(`تا ${whenFa(a.expiry, { isEnd: true, now })}`)}`]),
    ].join("\n");
  });
  const worst = alerts.reduce((w, a) => ({ yellow: 1, orange: 2, red: 3 })[a.level] > ({ yellow: 1, orange: 2, red: 3 })[w.level] ? a : w, alerts[0]);
  const types = [...new Set(alerts.flatMap((a) => a.types))];
  return rtl([
    `🌬 <b>صبح بخیر؛ هشدار هواشناسی برای امروز</b>`,
    `${fa(`هشدارهای هواشناسی امروز (${alerts.length.toLocaleString("fa-IR")} هشدار):`)}`,
    "",
    ...blocks.flatMap((b) => [b, ""]),
    "(همه ساعت‌ها به وقت ایرلند)",
    "",
    `✅ <b>توصیه:</b> ${fa(adviceFa(worst.level, types))}`,
    `${fa("چند ساعت پیش از شروع هر هشدار دوباره یادآوری می‌کنیم.")}`,
    "",
    `🔗 <a href="${link}">جزئیات کامل هشدارها در سایت</a>`,
    "",
    "#هشدار_هواشناسی #هواشناسی_ایرلند",
  ]);
}
