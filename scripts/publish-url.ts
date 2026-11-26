/**
 * Writes and publishes one article from a chosen URL (a story the editor asked for by hand).
 *   URL=... SOURCE_ID=joe CATEGORY=entertainment IMPORTANCE=3 RELEVANCE=1 SOURCE_DATE=2026-03-30 APPLY=true
 * Dry run unless APPLY=true. Pictures and the Telegram post are done by the usual scripts afterwards.
 */
import { adminDb } from "./lib/db";
import { env, envBool } from "./lib/env";
import { extractArticleText } from "./lib/extract";
import { cleanArticle, writeArticle, WRITER_MODEL } from "./lib/ai";
import { refreshSite } from "./lib/revalidate";
import { SOURCES } from "./sources";
import { decideRegion, labelSocialPosts, NI_NAME } from "../src/lib/region";

async function main() {
  const url = env("URL");
  const apply = envBool("APPLY", false);
  const source = SOURCES.find((s) => s.id === process.env.SOURCE_ID) ?? SOURCES.find((s) => url.includes(new URL(s.feed).hostname.replace(/^www\./, "")));
  const category = process.env.CATEGORY?.trim() || "ireland";
  const importance = Number(process.env.IMPORTANCE || 3);
  const relevance = Number(process.env.RELEVANCE || 1);
  const sourceDate = process.env.SOURCE_DATE?.trim() || new Date().toISOString();
  const db = adminDb();

  const { data: existing } = await db.from("articles").select("slug").eq("source_url", url).limit(1);
  if (existing?.length) return console.log(`Already published: ${existing[0].slug}`);

  const text = await extractArticleText(url);
  if (!text) throw new Error("Could not read the page.");
  const title = text.split("\n")[0].slice(0, 200);
  // Optional background pages (e.g. an explainer) the writer may use to explain terms and context.
  let background = "";
  for (const u of (process.env.EXTRA_URLS ?? "").split(/\s+/).filter(Boolean)) {
    const t = await extractArticleText(u);
    console.log(`  background ${u}: ${t ? t.length + " chars" : "not readable"}`);
    if (t) background += `\n\n[Background source (${new URL(u).hostname}), use only to explain context and terms; the news facts come from the main source above]\n${t.slice(0, 12000)}`;
  }
  // An older story covered now: make sure "this month", "on Monday" etc. are written as real dates.
  const today = new Date().toISOString().slice(0, 10);
  const note = process.env.EDITOR_NOTE?.trim();
  const dated0 = `[Editor note, not part of the source: the source was published on ${sourceDate.slice(0, 10)}; today is ${today}. Write every time reference relative to today, e.g. «در ماه مارس ۲۰۲۶» instead of «این ماه» or «روز دوشنبه».${note ? " " + note : ""}]\n\n${text}`;
  const dated = dated0 + background;
  const mode = source?.kind === "open" ? "translation" : "report";
  const w = await writeArticle({
    model: WRITER_MODEL,
    mode,
    sourceName: source?.nameEn ?? new URL(url).hostname,
    title,
    publishedAt: new Date(sourceDate).toISOString(),
    text: sourceDate.slice(0, 10) === today && !note && !background ? text : dated,
    light: category === "entertainment",
  });
  const a = w && (await cleanArticle(w));
  if (!a) throw new Error("Writer failed.");
  console.log(`${a.title_fa}\n\n${a.summary_fa}\n\n${a.body_fa}\n\n--- Telegram ---\n${a.telegram_post}\n\nconfidence: ${a.confidence}; notes: ${a.notes_for_editor}`);
  if (!apply) return console.log("\nDry run: nothing saved.");

  const base = a.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "news";
  const { data: clash } = await db.from("articles").select("id").eq("slug", base).limit(1);
  const slug = clash?.length ? `${base}-${Date.now().toString(36)}` : base;
  // REGION=ni|roi|both|other overrides the automatic choice.
  const region = decideRegion({ classifier: process.env.REGION, category, sourceIsNi: source?.hint === "northern-ireland", text: title });
  const ni = region === "ni";
  const { error } = await db.from("articles").insert({
    slug,
    title_fa: a.title_fa,
    summary_fa: a.summary_fa,
    body_fa: a.body_fa,
    category,
    tags: ni && !a.tags.includes(NI_NAME) ? [...a.tags, NI_NAME] : a.tags,
    immigrant_relevance: relevance,
    importance,
    mode,
    source_id: source?.id ?? "manual",
    source_name: source?.name ?? new URL(url).hostname,
    source_url: url,
    source_title: title,
    social: { ...labelSocialPosts({ telegram: a.telegram_post, x: a.x_post, instagram: a.instagram_caption, whatsapp: a.whatsapp_post }, ni), region },
    confidence: a.confidence,
    notes_for_editor: a.notes_for_editor,
    status: "published",
    published_at: new Date().toISOString(),
  });
  if (error) throw error;
  console.log(`\n✓ published: ${slug}`);
  await refreshSite([`/news/${slug}`, `/category/${category}`]);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
