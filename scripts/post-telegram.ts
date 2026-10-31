/**
 * Posts newly published articles to the Telegram channel.
 * Needs TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID (e.g. @irelandnewspersian) and SITE_URL.
 */
import { adminDb } from "./lib/db";
import { env, envOptional } from "./lib/env";
import { isolateForSocial } from "../src/lib/bidi";

const token = envOptional("TELEGRAM_BOT_TOKEN");
const channel = envOptional("TELEGRAM_CHANNEL_ID");

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  if (!token || !channel) {
    console.log("Telegram is not configured yet; skipping.");
    return;
  }
  const site = env("SITE_URL");
  const db = adminDb();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: articles, error } = await db
    .from("articles")
    .select("id, slug, title_fa, summary_fa, social")
    .eq("status", "published")
    .is("telegram_message_id", null)
    .gte("published_at", since)
    .order("published_at", { ascending: true })
    .limit(10);
  if (error) throw error;

  for (const a of articles ?? []) {
    const body = (a.social?.telegram as string | undefined) ?? `${a.title_fa}\n\n${a.summary_fa}`;
    const lines = isolateForSocial(body).split("\n");
    // Make the first line (the headline) bold.
    const text = [`<b>${escapeHtml(lines[0])}</b>`, ...lines.slice(1).map(escapeHtml)].join("\n");
    const link = `${site}/news/${a.slug}`;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: channel,
        text: `${text}\n\n‏🔗 <a href="${link}">متن کامل خبر</a>`,
        parse_mode: "HTML",
        link_preview_options: { url: link, prefer_large_media: true },
      }),
    });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!json.ok) {
      console.error(`✗ ${a.slug}: ${json.description}`);
      continue;
    }
    await db.from("articles").update({ telegram_message_id: json.result!.message_id }).eq("id", a.id);
    console.log(`✓ posted ${a.slug}`);
    await new Promise((r) => setTimeout(r, 3000)); // stay well under Telegram limits
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
