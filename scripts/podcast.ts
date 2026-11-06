/**
 * Nightly podcast: picks today's most important stories, writes a spoken Persian script,
 * reads it with text-to-speech, adds the intro/outro music, uploads the MP3, saves the
 * episode and posts it to Telegram.
 *
 * Started at 21:00 and 22:00 UTC by Supabase pg_cron; it only runs when it is 22:xx in Dublin
 * (so it is 10pm Irish time in both summer and winter). FORCE=true runs it anyway.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adminDb } from "./lib/db";
import { env, envBool, envInt, envOptional } from "./lib/env";
import { PODCAST_NAME } from "./lib/ai";
import { scriptText, writePodcastScript } from "./lib/podcast-script";
import { ttsProvider } from "./lib/tts";
import { refreshSite } from "./lib/revalidate";

const BUCKET = "news-images";
const TZ = "Europe/Dublin";

function dublinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const duration = (file: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

async function main() {
  const force = envBool("FORCE", false);
  const { date, hour } = dublinNow();
  if (!force && hour !== 22) {
    console.log(`It is ${hour}:xx in Dublin, not 22:xx; nothing to do.`);
    return;
  }
  const db = adminDb();
  const { data: existing } = await db.from("podcasts").select("id").eq("episode_date", date).maybeSingle();
  if (existing && !force) {
    console.log(`Episode for ${date} already exists.`);
    return;
  }
  const tts = ttsProvider();
  if (!tts) {
    console.log("No text-to-speech account configured yet; skipping.");
    return;
  }

  // 1) today's stories (last 24 hours), most important first
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: rows, error } = await db
    .from("articles")
    .select("slug, title_fa, summary_fa, body_fa, category, importance, immigrant_relevance, published_at")
    .eq("status", "published")
    .gte("published_at", since);
  if (error) throw error;
  const max = envInt("PODCAST_STORIES", 5);
  const serious = (rows ?? [])
    .filter((a) => a.category !== "entertainment")
    .sort((a, b) => b.importance * 2 + b.immigrant_relevance * 2 - (a.importance * 2 + a.immigrant_relevance * 2))
    .slice(0, max);
  const light = (rows ?? []).filter((a) => a.category === "entertainment").sort((a, b) => b.importance - a.importance)[0];
  const picked = light ? [...serious, light] : serious;
  if (picked.length < 3) {
    console.log(`Only ${picked.length} stories today; skipping.`);
    return;
  }
  console.log(`Stories:\n${picked.map((a) => ` - ${a.title_fa}`).join("\n")}`);

  // 2) script
  const dateFa = new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const script = await writePodcastScript(picked, dateFa);
  if (!script) throw new Error("Could not write the podcast script.");
  console.log(`\n${scriptText(script)}\n`);

  // 3) voice, one segment at a time
  const dir = mkdtempSync(join(tmpdir(), "podcast-"));
  const segments = [script.intro, ...script.stories.map((s) => `${s.headline}. ${s.text}`), script.outro];
  const files: string[] = [];
  for (const [i, text] of segments.entries()) {
    const f = join(dir, `seg${i}.mp3`);
    writeFileSync(f, await tts.speak(text));
    files.push(f);
  }
  console.log(`Voice: ${tts.name}, ${files.length} segments`);

  // 4) mix: intro music → voice segments with short pauses → outro music, loudness-normalised
  const intro = "assets/podcast/intro.mp3";
  const outro = "assets/podcast/outro.mp3";
  const inputs = [intro, ...files, outro].flatMap((f) => ["-i", f]);
  const n = files.length;
  const pads = files.map((_, i) => `[${i + 1}:a]aresample=44100,aformat=channel_layouts=stereo,apad=pad_dur=0.7[v${i}]`).join(";");
  const filter =
    `[0:a]aresample=44100,aformat=channel_layouts=stereo[m0];` +
    `${pads};` +
    `[${n + 1}:a]aresample=44100,aformat=channel_layouts=stereo[m1];` +
    `[m0]${files.map((_, i) => `[v${i}]`).join("")}[m1]concat=n=${n + 2}:v=0:a=1,loudnorm=I=-16:TP=-1.5:LRA=11[out]`;
  const out = join(dir, "episode.mp3");
  ffmpeg([...inputs, "-filter_complex", filter, "-map", "[out]", "-ar", "44100", "-b:a", "128k", out]);
  const audio = readFileSync(out);
  const seconds = Math.round(duration(out));
  console.log(`Episode: ${seconds}s, ${(audio.length / 1e6).toFixed(1)} MB`);

  // 5) upload + save
  const path = `podcasts/${date}-ireland-news-persian.mp3`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, audio, { contentType: "audio/mpeg", upsert: true, cacheControl: "31536000" });
  if (upErr) throw upErr;
  const audioUrl = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const row = {
    episode_date: date,
    title: script.episode_title,
    description: script.description,
    script: scriptText(script),
    audio_url: audioUrl,
    duration_sec: seconds,
    size_bytes: audio.length,
    article_slugs: picked.map((a) => a.slug),
  };
  const { error: insErr } = await db.from("podcasts").upsert(row, { onConflict: "episode_date" });
  if (insErr) throw insErr;
  await refreshSite();

  // 6) Telegram
  const token = envOptional("TELEGRAM_BOT_TOKEN");
  const channel = envOptional("TELEGRAM_CHANNEL_ID");
  if (token && channel && envOptional("PODCAST_TELEGRAM") !== "false") {
    const site = env("SITE_URL");
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const caption =
      `🎙 <b>${esc(PODCAST_NAME)}</b> | ${esc(dateFa)}\n\n` +
      script.stories.map((s) => `▫️ ${esc(s.headline)}`).join("\n") +
      `\n\n‏🔗 <a href="${site}/podcast">همه قسمت‌ها در سایت</a>`;
    const form = new FormData();
    form.set("chat_id", channel);
    form.set("audio", new Blob([audio], { type: "audio/mpeg" }), `${date}.mp3`);
    form.set("caption", caption.slice(0, 1020));
    form.set("parse_mode", "HTML");
    form.set("title", `${PODCAST_NAME} | ${script.episode_title}`.slice(0, 64));
    form.set("performer", "اخبار ایرلند به فارسی");
    form.set("duration", String(seconds));
    form.set("thumbnail", new Blob([readFileSync("assets/podcast/cover-320.jpg")], { type: "image/jpeg" }), "cover.jpg");
    const res = await fetch(`https://api.telegram.org/bot${token}/sendAudio`, { method: "POST", body: form });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (json.ok) {
      await db.from("podcasts").update({ telegram_message_id: json.result!.message_id }).eq("episode_date", date);
      console.log("✓ posted to Telegram");
    } else console.error("Telegram failed:", json.description);
  }
  console.log(`✓ ${PODCAST_NAME}: ${script.episode_title}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
