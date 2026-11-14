/**
 * Rewrites already-published articles from one day (Dublin time) with the current writer
 * (WRITER_VOICE, WRITER_MODEL). Keeps slug, picture, category and Telegram post history.
 * DRY run by default; APPLY=true saves. REWRITE_DATE=YYYY-MM-DD (default: yesterday in Dublin).
 * REWRITE_MATCH=text limits it to articles whose Persian title contains that text.
 * EDIT_TELEGRAM=true (with APPLY) also edits the already-sent channel post to the new text.
 */
import { writeFileSync } from "node:fs";
import { adminDb } from "./lib/db";
import { envBool } from "./lib/env";
import { extractArticleText } from "./lib/extract";
import { cleanArticle, writeArticle, WRITER_MODEL } from "./lib/ai";
import { refreshSite } from "./lib/revalidate";
import { telegramNewsText } from "./lib/telegram-format";

const dublinDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(d);

async function main() {
  const apply = envBool("APPLY", false);
  const date = process.env.REWRITE_DATE?.trim() || dublinDate(new Date(Date.now() - 24 * 3600 * 1000));
  const from = new Date(`${date}T00:00:00Z`).getTime() - 3 * 3600 * 1000;
  const to = new Date(`${date}T00:00:00Z`).getTime() + 27 * 3600 * 1000;
  const db = adminDb();
  const { data, error } = await db
    .from("articles")
    .select("*")
    .eq("status", "published")
    .gte("published_at", new Date(from).toISOString())
    .lt("published_at", new Date(to).toISOString())
    .order("published_at");
  if (error) throw error;
  const match = process.env.REWRITE_MATCH?.trim();
  const editTelegram = envBool("EDIT_TELEGRAM", false);
  const rows = (data ?? []).filter(
    (r) => dublinDate(new Date(r.published_at)) === date && (!match || String(r.title_fa).includes(match) || String(r.source_title ?? "").includes(match)),
  );
  console.log(`${rows.length} articles published on ${date} (Dublin). Voice: ${process.env.WRITER_VOICE ?? "default"}, model: ${WRITER_MODEL}. ${apply ? "APPLY" : "dry run"}`);

  // Backup of the old text, kept as a workflow artifact.
  writeFileSync("rewrite-backup.json", JSON.stringify(rows, null, 2));
  let done = 0;
  for (const r of rows) {
    const text = await extractArticleText(r.source_url);
    if (!text) {
      console.log(`– skip (source text not available): ${r.slug}`);
      continue;
    }
    const w = await writeArticle({
      mode: r.mode === "translation" ? "translation" : "report",
      sourceName: r.source_name,
      title: r.source_title ?? r.title_fa,
      publishedAt: r.published_at,
      text,
      light: r.category === "entertainment",
    });
    const a = w && (await cleanArticle(w));
    if (!a || a.confidence === "low") {
      console.log(`– skip (writer failed or unsure): ${r.slug}`);
      continue;
    }
    console.log(`• ${r.slug}\n    before: ${r.title_fa}\n    after:  ${a.title_fa}`);
    if (match) console.log(`  telegram before:\n${r.social?.telegram ?? ""}\n  telegram after:\n${a.telegram_post}\n  body after:\n${a.body_fa}\n`);
    if (apply) {
      const { error: e } = await db
        .from("articles")
        .update({
          title_fa: a.title_fa,
          summary_fa: a.summary_fa,
          body_fa: a.body_fa,
          tags: a.tags,
          social: { ...(r.social ?? {}), telegram: a.telegram_post, x: a.x_post, instagram: a.instagram_caption, whatsapp: a.whatsapp_post },
          notes_for_editor: a.notes_for_editor,
        })
        .eq("id", r.id);
      if (e) {
        console.warn("  save failed:", e.message);
        continue;
      }
      if (editTelegram && r.telegram_message_id) await editChannelPost(r.telegram_message_id, a.telegram_post, r.slug);
    }
    done++;
  }
  console.log(`\n${done} of ${rows.length} articles ${apply ? "rewritten" : "would be rewritten"}.`);
  if (apply && done) await refreshSite();
}

async function editChannelPost(messageId: number, body: string, slug: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = process.env.TELEGRAM_CHANNEL_ID;
  const site = process.env.SITE_URL;
  if (!token || !channel || !site) return console.warn("  Telegram not configured; post not edited.");
  const link = `${site}/news/${slug}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: channel,
      message_id: messageId,
      text: telegramNewsText(body, link),
      parse_mode: "HTML",
      link_preview_options: { url: link, prefer_large_media: true },
    }),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  console.log(json.ok ? `  ✓ Telegram post ${messageId} edited` : `  ✗ Telegram edit failed: ${json.description}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
