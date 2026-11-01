/**
 * Try the Persian writer on one article without touching the database:
 *   npx tsx scripts/try-article.ts <article-url> [report|translation]
 * Needs only ANTHROPIC_API_KEY.
 */
import { extractArticleText } from "./lib/extract";
import { writeArticle } from "./lib/ai";
import { isolateForSocial } from "../src/lib/bidi";

async function main() {
  const [url, modeArg] = process.argv.slice(2);
  if (!url) {
    console.error(
      "Usage: npx tsx scripts/try-article.ts <article-url> [report|translation]",
    );
    process.exit(1);
  }
  const text = await extractArticleText(url);
  if (!text) {
    console.error("Could not read that page.");
    process.exit(1);
  }
  const mode = modeArg === "translation" ? "translation" : "report";
  const a = await writeArticle({
    mode,
    sourceName: new URL(url).hostname,
    title: "",
    publishedAt: new Date().toISOString(),
    text,
  });
  if (!a) process.exit(1);
  console.log(`\n# ${a.title_fa}\n\n${a.summary_fa}\n\n${a.body_fa}\n`);
  console.log("--- Telegram ---\n" + isolateForSocial(a.telegram_post));
  console.log("\n--- X ---\n" + isolateForSocial(a.x_post));
  console.log(`\nconfidence: ${a.confidence}\nnotes: ${a.notes_for_editor}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
