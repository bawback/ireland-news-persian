/** Posts a new guide to the Telegram channel. Reads guide-result.txt written by write-guide.ts. */
import { readFileSync } from "node:fs";
import { env, envOptional } from "./lib/env";

async function main() {
  const [slug, title, description] = readFileSync("guide-result.txt", "utf8").split("\n");
  const token = envOptional("TELEGRAM_BOT_TOKEN");
  const channel = envOptional("TELEGRAM_CHANNEL_ID");
  if (!token || !channel || !slug) return console.log("Nothing to post.");
  const url = `${env("SITE_URL")}/guides/${slug}`;
  // Wait until the new page is live (the commit triggers a new deploy).
  for (let i = 0; i < 30; i++) {
    const r = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (r?.ok) break;
    await new Promise((res) => setTimeout(res, 20_000));
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const text = `📘 <b>راهنمای تازه: ${esc(title)}</b>\n\n${esc(description)}\n\n‏🔗 <a href="${url}">خواندن راهنمای کامل</a>\n\n#راهنما #مهاجرت_به_ایرلند #اخبار_ایرلند`;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: channel, text, parse_mode: "HTML" }),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  console.log(json.ok ? "✓ posted to Telegram" : `Telegram failed: ${json.description}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
