/**
 * Morning digest for the Telegram channel: the 5 most important stories of the last 24 hours.
 * Runs every hour inside the news pipeline; posts only at 08:xx Dublin time (or with FORCE),
 * and only once a day: a small marker file in storage remembers that today's digest was sent.
 */
import { adminDb } from "./lib/db";
import { env, envBool, envOptional } from "./lib/env";
import { formatDayFa } from "../src/lib/dates";
import { isolateForSocial } from "../src/lib/bidi";

const BUCKET = "news-images";
const COUNT = 5;
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const faNum = (n: number) => n.toLocaleString("fa-IR");

function dublinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

type Row = { slug: string; title_fa: string; category: string; importance: number; immigrant_relevance: number; social: { coverage?: { count: number } } | null };

async function main() {
  const token = envOptional("TELEGRAM_BOT_TOKEN");
  const channel = envOptional("TELEGRAM_CHANNEL_ID");
  if (!token || !channel) return console.log("Telegram is not configured; skipping.");
  const force = envBool("FORCE", false);
  const now = dublinNow();
  if (!force && now.hour !== 8) return console.log(`It is ${now.hour}:xx in Dublin, not 08:xx; nothing to do.`);

  const db = adminDb();
  const marker = `digests/${now.date}.json`;
  if (!force) {
    const { data } = await db.storage.from(BUCKET).list("digests", { search: `${now.date}.json` });
    if (data?.some((f) => f.name === `${now.date}.json`)) return console.log("Today's digest was already posted.");
  }

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data, error } = await db
    .from("articles")
    .select("slug, title_fa, category, importance, immigrant_relevance, social")
    .eq("status", "published")
    .gte("published_at", since)
    .limit(200);
  if (error) throw error;
  const score = (a: Row) =>
    a.importance * 2 + a.immigrant_relevance * 2 + Math.min(a.social?.coverage?.count ?? 1, 5) - (a.category === "entertainment" ? 3 : 0);
  const top = ((data ?? []) as Row[]).sort((a, b) => score(b) - score(a)).slice(0, COUNT);
  if (top.length < 3) return console.log(`Only ${top.length} stories in the last 24 hours; no digest.`);

  const site = env("SITE_URL");
  const lines = top.map((a, i) => {
    const hot = (a.social?.coverage?.count ?? 1) >= 3 ? " 🔥" : "";
    return `${faNum(i + 1)}. <a href="${site}/news/${a.slug}">${escapeHtml(isolateForSocial(a.title_fa))}</a>${hot}`;
  });
  const text = [
    `☀️ <b>صبح بخیر! ${faNum(top.length)} خبر مهم ایرلند در ۲۴ ساعت گذشته</b>`,
    `📅 ${formatDayFa(now.date)}`,
    "",
    ...lines.flatMap((l) => [l, ""]),
    `🌐 همه خبرها: <a href="${site}">${site.replace(/^https?:\/\//, "")}</a>`,
    "📲 این کانال را به دوستان‌تان در ایرلند معرفی کنید 🙏",
  ].join("\n");

  if (envBool("DRY_RUN", false)) return console.log(`DRY RUN, not posted:\n${text}`);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: channel, text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
  });
  const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!json.ok) throw new Error(`Telegram: ${json.description}`);
  await db.storage
    .from(BUCKET)
    .upload(marker, JSON.stringify({ message_id: json.result!.message_id, slugs: top.map((a) => a.slug) }), { contentType: "application/json", upsert: true });
  console.log(`Posted digest (message ${json.result!.message_id}):\n${text}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
