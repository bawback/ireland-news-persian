/**
 * Rewrites a few recent articles with the current writer prompt on one or more models
 * and prints old vs new side by side (Markdown). Nothing is saved to the database.
 * COMPARE_MODELS="claude-haiku-5-5,claude-sonnet-5-5"  COMPARE_COUNT=4
 */
import { writeFileSync } from "node:fs";
import { adminDb } from "./lib/db";
import { envInt } from "./lib/env";
import { extractArticleText } from "./lib/extract";
import { cleanArticle, writeArticle } from "./lib/ai";

const firstParas = (body: string, n = 2) =>
  body.split(/\n\s*\n/).filter((p) => p.trim() && !p.startsWith("## ")).slice(0, n).join("\n\n");

async function main() {
  const models = (process.env.COMPARE_MODELS ?? "claude-haiku-5-5,claude-sonnet-5-5").split(",").map((m) => m.trim());
  // COMPARE_VOICES="default,babak" compares voices; each model × voice is written.
  const voices = (process.env.COMPARE_VOICES ?? "default").split(",").map((v) => v.trim());
  const count = envInt("COMPARE_COUNT", 4);
  const db = adminDb();
  const { data, error } = await db
    .from("articles")
    .select("slug, title_fa, summary_fa, body_fa, source_name, source_url, source_title, mode, category, published_at")
    .eq("status", "published")
    .eq("mode", "report")
    .neq("category", "entertainment")
    .order("published_at", { ascending: false })
    .limit(count);
  if (error) throw error;

  const out: string[] = ["# مقایسه نوشتن خبرها: قبل و بعد\n"];
  for (const a of data ?? []) {
    const text = await extractArticleText(a.source_url);
    if (!text) {
      console.log(`skip (no source text): ${a.slug}`);
      continue;
    }
    out.push(`---\n\n## منبع: ${a.source_name} — ${a.source_title}\n`);
    out.push(`### قبل (نسخه فعلی سایت)\n\n**تیتر:** ${a.title_fa}\n\n**خلاصه:** ${a.summary_fa}\n\n${voices.length > 1 ? a.body_fa : firstParas(a.body_fa)}\n`);
    for (const model of models) for (const voice of voices) {
      const label = `${model}${voices.length > 1 ? ` — ${voice}` : ""}`;
      const w = await writeArticle({ model, mode: "report", sourceName: a.source_name, title: a.source_title, publishedAt: a.published_at, text, voice });
      if (!w) {
        out.push(`### بعد — ${label}\n\n(نوشته نشد)\n`);
        continue;
      }
      const c = await cleanArticle(w);
      out.push(`### بعد — ${label}\n\n**تیتر:** ${c.title_fa}\n\n**خلاصه:** ${c.summary_fa}\n\n${voices.length > 1 ? c.body_fa : firstParas(c.body_fa)}\n`);
    }
  }
  const md = out.join("\n");
  writeFileSync("compare.md", md);
  console.log(md);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
