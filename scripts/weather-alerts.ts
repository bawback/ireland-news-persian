/**
 * Severe-weather alerts for the Telegram channel and the website (/weather).
 *
 * Runs every hour inside the news pipeline, plus a few night runs (supabase/weather.sql).
 *  1. Reads the official warnings: Met Éireann (Ireland) and Met Office (Northern Ireland).
 *  2. Keeps the ones that matter (src/lib/weather.ts → isRelevant): Dublin, Galway and Cork for
 *     wind/storm warnings at every level, and orange/red warnings anywhere.
 *  3. New warning → faithful Persian translation, saved for the website, posted to Telegram
 *     with the exact day and start/end times.
 *  4. Changed warning (level, times, areas) → an update post, as a reply to the first one.
 *  5. At 07:xx Dublin time on a day with warnings → one "today's warnings" post.
 *  6. About 4 hours before a warning starts → a reminder (never at night: moved to 22:00 the evening before).
 *  7. Ended or cancelled → a short note is added to the first Telegram post; the website hides it.
 *
 * DRY_RUN=true prints the posts instead of sending them (the database is not changed).
 */
import { adminDb } from "./lib/db";
import { env, envBool, envOptional } from "./lib/env";
import { refreshSite } from "./lib/revalidate";
import { translateWarning } from "./lib/ai";
import { fetchMetEireann, fetchMetOfficeNI } from "./lib/weather-feeds";
import { alertPostText, cancelledNote, describeChange, endedNote, fallbackTitle, morningText, reminderText } from "./lib/weather-format";
import {
  LEVEL_FA,
  LEVEL_ORDER,
  MORNING_HOUR,
  alertAnchor,
  areasFa,
  dublinDay,
  dublinHour,
  groupWarnings,
  inMorningPost,
  isQuietHour,
  isRelevant,
  reminderNeeded,
  type AlertGroup,
  type Level,
  type WeatherSource,
  type Warning,
} from "../src/lib/weather";

const DRY_RUN = envBool("DRY_RUN", false);
const FORCE_MORNING = envBool("FORCE_MORNING", false);
const token = envOptional("TELEGRAM_BOT_TOKEN");
const channel = envOptional("TELEGRAM_CHANNEL_ID");
const site = env("SITE_URL", "https://irelandnewspersian.com");

interface Row {
  key: string;
  source: WeatherSource;
  level: Level;
  types: string[];
  regions: string[];
  areas_fa: string;
  headline_en: string;
  description_en: string;
  title_fa: string;
  body_fa: string;
  onset: string;
  expiry: string;
  link: string;
  status: "active" | "cancelled";
  relevant: boolean;
  telegram_message_id: number | null;
  telegram_text: string | null;
  first_posted_at: string | null;
  reminder_sent_at: string | null;
  morning_sent_at: string | null;
  closed_note_at: string | null;
}

const db = DRY_RUN && !process.env.SUPABASE_URL ? null : adminDb();
let changed = false;

const pageLink = (key?: string) => `${site}/weather${key ? `#${alertAnchor(key)}` : ""}`;

async function telegram(method: string, body: Record<string, unknown>): Promise<{ message_id: number } | null> {
  if (DRY_RUN) {
    console.log(`\n--- DRY RUN ${method} ---\n${String(body.text ?? "")}\n`);
    return { message_id: 0 };
  }
  if (!token || !channel) {
    console.log("Telegram is not configured; not posting.");
    return null;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: channel, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...body }),
  });
  const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
  if (!json.ok) {
    console.error(`  Telegram ${method} failed: ${json.description}`);
    return null;
  }
  await new Promise((r) => setTimeout(r, 1500));
  return json.result ?? { message_id: 0 };
}

/** Night posts are silent (no sound on phones), except red warnings. */
const silent = (level: Level, now: Date) => isQuietHour(now) && level !== "red";

async function save(key: string, patch: Partial<Row>) {
  if (DRY_RUN || !db) return;
  const { error } = await db.from("weather_alerts").update({ ...patch, updated_at: new Date().toISOString() }).eq("key", key);
  if (error) throw error;
  changed = true;
}

async function readFeeds(): Promise<{ warnings: Warning[]; readOk: Set<WeatherSource> }> {
  const readOk = new Set<WeatherSource>();
  const warnings: Warning[] = [];
  const [ie, ni] = await Promise.allSettled([fetchMetEireann(), fetchMetOfficeNI()]);
  if (ie.status === "fulfilled") {
    readOk.add("met_eireann");
    warnings.push(...ie.value);
    console.log(`✓ Met Éireann: ${ie.value.length} warnings`);
  } else console.warn(`✗ Met Éireann: ${String(ie.reason).slice(0, 200)}`);
  if (ni.status === "fulfilled") {
    readOk.add("met_office");
    warnings.push(...ni.value);
    console.log(`✓ Met Office NI: ${ni.value.length} warnings`);
  } else console.warn(`✗ Met Office NI: ${String(ni.reason).slice(0, 200)}`);
  return { warnings, readOk };
}

async function loadRows(): Promise<Row[]> {
  if (!db) return [];
  const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
  const { data, error } = await db.from("weather_alerts").select("*").gte("expiry", since);
  if (error) throw error;
  return (data ?? []) as Row[];
}

const overlaps = (a: string[], b: string[]) => a.some((x) => b.includes(x));
const timesOverlap = (a: { onset: string; expiry: string }, b: { onset: string; expiry: string }) =>
  Date.parse(a.onset) < Date.parse(b.expiry) && Date.parse(b.onset) < Date.parse(a.expiry);

/** A warning the source re-issued under new ids is the same warning, not a new one. */
function findPrevious(g: AlertGroup, rows: Row[], liveKeys: Set<string>): Row | undefined {
  return rows.find(
    (r) => r.source === g.source && r.status === "active" && !liveKeys.has(r.key) && overlaps(r.types.map((t) => t.toLowerCase()), g.types.map((t) => t.toLowerCase())) && overlaps(r.regions, g.regions) && timesOverlap(r, g),
  );
}

async function translated(g: AlertGroup, areas: string) {
  const t = await translateWarning({ headline: g.headline, description: g.description, levelFa: LEVEL_FA[g.level].name, areasFa: areas });
  return t ?? { title_fa: fallbackTitle({ level: g.level, types: g.types, areas_fa: areas }), body_fa: "" };
}

async function handleNew(g: AlertGroup, now: Date): Promise<Row> {
  const relevant = isRelevant(g);
  const areas = areasFa(g.regions);
  console.log(`+ ${g.key} ${g.level} ${g.types.join("/")} ${areas} ${relevant ? "" : "(not posted: not relevant)"}`);
  const t = relevant ? await translated(g, areas) : { title_fa: fallbackTitle({ level: g.level, types: g.types, areas_fa: areas }), body_fa: "" };
  const row: Row = {
    key: g.key,
    source: g.source,
    level: g.level,
    types: g.types,
    regions: g.regions,
    areas_fa: areas,
    headline_en: g.headline,
    description_en: g.description,
    title_fa: t.title_fa,
    body_fa: t.body_fa,
    onset: g.onset,
    expiry: g.expiry,
    link: g.link,
    status: "active",
    relevant,
    telegram_message_id: null,
    telegram_text: null,
    first_posted_at: null,
    reminder_sent_at: null,
    morning_sent_at: null,
    closed_note_at: null,
  };
  if (!DRY_RUN && db) {
    const { error } = await db.from("weather_alerts").upsert(row);
    if (error) throw error;
    changed = true;
  }
  if (relevant && Date.parse(g.expiry) > now.getTime()) {
    const text = alertPostText(row, pageLink(row.key), now);
    const sent = await telegram("sendMessage", { text, disable_notification: silent(row.level, now) });
    if (sent) {
      row.telegram_message_id = sent.message_id;
      row.telegram_text = text;
      row.first_posted_at = now.toISOString();
      await save(row.key, { telegram_message_id: sent.message_id, telegram_text: text, first_posted_at: row.first_posted_at });
    }
  }
  return row;
}

async function handleExisting(g: AlertGroup, row: Row, now: Date): Promise<Row> {
  const areas = areasFa(g.regions);
  const change = describeChange(row, { ...g, areas_fa: areas });
  if (!change && row.key === g.key) return row;
  const relevant = isRelevant(g);
  console.log(`~ ${row.key} → ${g.key}: ${change ?? "new ids"}`);
  const t = relevant && change ? await translated(g, areas) : { title_fa: row.title_fa, body_fa: row.body_fa };
  const onsetMoved = Math.abs(Date.parse(row.onset) - Date.parse(g.onset)) >= 15 * 60_000;
  const next: Row = {
    ...row,
    key: g.key,
    level: g.level,
    types: g.types,
    regions: g.regions,
    areas_fa: areas,
    headline_en: g.headline,
    description_en: g.description,
    title_fa: t.title_fa,
    body_fa: t.body_fa,
    onset: g.onset,
    expiry: g.expiry,
    link: g.link,
    relevant: row.relevant || relevant,
    reminder_sent_at: onsetMoved ? null : row.reminder_sent_at,
  };
  if (!DRY_RUN && db) {
    const { key: _old, ...rest } = next;
    void _old;
    const { error } = await db.from("weather_alerts").update({ ...rest, key: g.key, updated_at: now.toISOString() }).eq("key", row.key);
    if (error) throw error;
    changed = true;
  }
  if (change && relevant && Date.parse(g.expiry) > now.getTime()) {
    const text = alertPostText(next, pageLink(next.key), now, change);
    const reply = next.telegram_message_id ? { reply_parameters: { message_id: next.telegram_message_id, allow_sending_without_reply: true } } : {};
    const sent = await telegram("sendMessage", { text, disable_notification: silent(next.level, now), ...reply });
    if (sent && !next.first_posted_at) {
      // It became relevant only now (e.g. yellow → orange outside the three cities): this is its first post.
      next.telegram_message_id = sent.message_id;
      next.telegram_text = text;
      next.first_posted_at = now.toISOString();
      await save(next.key, { telegram_message_id: sent.message_id, telegram_text: text, first_posted_at: next.first_posted_at });
    }
  }
  return next;
}

/** Adds a note at the end of the first Telegram post (ended / cancelled). */
async function closeNote(row: Row, note: string, now: Date) {
  if (row.closed_note_at) return;
  if (row.telegram_message_id && row.telegram_text) {
    await telegram("editMessageText", { message_id: row.telegram_message_id, text: `${row.telegram_text}\n\n${note}` });
  }
  await save(row.key, { closed_note_at: now.toISOString() });
}

async function morningPost(rows: Row[], now: Date) {
  // Fresh alerts are still listed when the morning post goes out anyway for older ones.
  const todaysOthers = (r: Row) => rows.some((o) => o !== r && o.first_posted_at && now.getTime() - Date.parse(o.first_posted_at) > 60 * 60_000 && inMorningPost(o, now));
  if (!FORCE_MORNING && dublinHour(now.getTime()) !== MORNING_HOUR) return;
  const today = dublinDay(now.getTime());
  const todays = rows
    .filter((r) => r.relevant && r.status === "active" && inMorningPost(r, now))
    // A warning first posted in this same run is already fresh in the channel.
    .filter((r) => !r.first_posted_at || now.getTime() - Date.parse(r.first_posted_at) > 60 * 60_000 || todaysOthers(r))
    .sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level] || Date.parse(a.onset) - Date.parse(b.onset));
  if (!todays.length) return console.log("Morning: no warnings today.");
  if (!FORCE_MORNING && todays.every((r) => r.morning_sent_at && dublinDay(Date.parse(r.morning_sent_at)) === today)) {
    return console.log("Morning: today's post was already sent.");
  }
  const sent = await telegram("sendMessage", { text: morningText(todays, pageLink(), now) });
  if (!sent) return;
  for (const r of todays) {
    r.morning_sent_at = now.toISOString();
    await save(r.key, { morning_sent_at: r.morning_sent_at });
  }
  console.log(`Morning: posted ${todays.length} warnings.`);
}

async function reminders(rows: Row[], now: Date) {
  for (const r of rows) {
    if (!r.relevant || r.status !== "active" || !reminderNeeded(r, now)) continue;
    const reply = r.telegram_message_id ? { reply_parameters: { message_id: r.telegram_message_id, allow_sending_without_reply: true } } : {};
    const sent = await telegram("sendMessage", { text: reminderText(r, pageLink(r.key), now), ...reply });
    if (sent) {
      r.reminder_sent_at = now.toISOString();
      await save(r.key, { reminder_sent_at: r.reminder_sent_at });
      console.log(`⏰ reminder for ${r.key}`);
    }
  }
}

async function main() {
  const now = new Date();
  const { warnings, readOk } = await readFeeds();
  const groups = groupWarnings(warnings);
  let rows = await loadRows();
  const liveKeys = new Set(groups.map((g) => g.key));
  const current: Row[] = [];

  for (const g of groups) {
    const same = rows.find((r) => r.key === g.key) ?? findPrevious(g, rows, liveKeys);
    try {
      const row = same ? await handleExisting(g, same, now) : await handleNew(g, now);
      if (same) rows = rows.filter((r) => r !== same);
      current.push(row);
    } catch (e) {
      console.error(`✗ ${g.key}: ${String(e).slice(0, 300)}`);
    }
  }

  // Gone from a feed that was read fine: ended (past expiry) or cancelled (before expiry).
  for (const r of rows) {
    if (r.closed_note_at) continue;
    if (Date.parse(r.expiry) <= now.getTime()) await closeNote(r, endedNote, now);
    else if (readOk.has(r.source) && r.status === "active") {
      console.log(`✖ cancelled: ${r.key}`);
      await save(r.key, { status: "cancelled" });
      await closeNote(r, cancelledNote, now);
    }
  }
  // Still in the feed but already over.
  for (const r of current) if (Date.parse(r.expiry) <= now.getTime() && !r.closed_note_at) await closeNote(r, endedNote, now);

  await morningPost(current, now);
  await reminders(current, now);
  if (changed) await refreshSite();
  console.log(`Done: ${current.filter((r) => r.relevant && Date.parse(r.expiry) > now.getTime()).length} active alerts for the channel.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
