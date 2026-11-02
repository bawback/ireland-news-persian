/**
 * The news pipeline. Run every 15–30 minutes (GitHub Actions does this automatically).
 *
 *  1. Read all RSS feeds
 *  2. Skip items we have already seen
 *  3. Classify new items with a fast model (relevant? category? important for immigrants?)
 *  4. Drop duplicates of the same story
 *  5. Write the best items in Persian with the main model
 *  6. Save to the database (published, or waiting for review)
 */
import { createHash } from "node:crypto";
import { SOURCES, type Source } from "./sources";
import { fetchFeed, type FeedItem } from "./lib/feeds";
import { extractArticleText } from "./lib/extract";
import { classifyItems, writeArticle, WRITER_MODEL, WRITER_MODEL_IMPORTANT, type Classification } from "./lib/ai";
import { adminDb } from "./lib/db";
import { envBool, envInt, envOptional } from "./lib/env";

const MAX_AGE_HOURS = envInt("MAX_AGE_HOURS", 36);
const MAX_ARTICLES_PER_RUN = envInt("MAX_ARTICLES_PER_RUN", 3);
const MIN_IMPORTANCE = envInt("MIN_IMPORTANCE", 3);
const REQUIRE_REVIEW = envBool("REQUIRE_REVIEW", false); // false = fully automatic publishing

const db = adminDb();
const sourceById = new Map(SOURCES.map((s) => [s.id, s]));
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 8);

async function readAllFeeds(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(SOURCES.map((s) => fetchFeed(s, MAX_AGE_HOURS)));
  const items: FeedItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`✓ ${SOURCES[i].nameEn}: ${r.value.length} items`);
      items.push(...r.value);
    } else {
      console.warn(`✗ ${SOURCES[i].nameEn}: ${String(r.reason).slice(0, 120)}`);
    }
  });
  return items;
}

async function filterUnseen(items: FeedItem[]): Promise<FeedItem[]> {
  const unique = [...new Map(items.map((i) => [i.url, i])).values()];
  const seen = new Set<string>();
  for (let i = 0; i < unique.length; i += 40) {
    const urls = unique.slice(i, i + 40).map((x) => x.url);
    const { data, error } = await db.from("raw_items").select("url").in("url", urls);
    if (error) throw error;
    data?.forEach((r) => seen.add(r.url));
  }
  return unique.filter((i) => !seen.has(i.url));
}

async function classifyAll(items: FeedItem[]): Promise<Map<string, Classification>> {
  const out = new Map<string, Classification>();
  for (let i = 0; i < items.length; i += 40) {
    const batch = items.slice(i, i + 40);
    const results = await classifyItems(
      batch.map((it, j) => ({
        index: j,
        source: sourceById.get(it.sourceId)?.nameEn ?? it.sourceId,
        title: it.title,
        summary: it.summary.slice(0, 400),
      })),
    );
    for (const r of results) {
      const it = batch[r.index];
      if (it) out.set(it.url, r);
    }
  }
  return out;
}

async function recentStoryKeys(): Promise<Set<string>> {
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const { data } = await db.from("raw_items").select("story_key").eq("status", "done").gte("created_at", since);
  return new Set((data ?? []).map((r) => r.story_key).filter(Boolean));
}

function score(c: Classification, s: Source) {
  return c.importance * 2 + c.immigrant_relevance * 2 + s.priority / 5;
}

async function uniqueSlug(base: string): Promise<string> {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "news";
  const { data } = await db.from("articles").select("id").eq("slug", clean).limit(1);
  return data && data.length ? `${clean}-${hash(clean + Date.now())}` : clean;
}

async function main() {
  const all = await readAllFeeds();
  const fresh = await filterUnseen(all);
  console.log(`\n${all.length} items in feeds, ${fresh.length} new`);
  if (!fresh.length) return;

  // Remember every new item so we never pay to process it twice.
  const { error: insErr } = await db.from("raw_items").insert(
    fresh.map((it) => ({
      url: it.url,
      source_id: it.sourceId,
      title: it.title,
      summary: it.summary.slice(0, 2000),
      published_at: it.publishedAt,
      status: "new",
    })),
  );
  if (insErr) throw insErr;

  const classes = await classifyAll(fresh);
  const seenKeys = await recentStoryKeys();

  // Pick the best item for each story.
  const bestByStory = new Map<string, { it: FeedItem; c: Classification; s: Source }>();
  for (const it of fresh) {
    const c = classes.get(it.url);
    const s = sourceById.get(it.sourceId)!;
    const status = !c || !c.relevant || c.importance < MIN_IMPORTANCE ? "skipped" : "candidate";
    await db
      .from("raw_items")
      .update({ status, category: c?.category, importance: c?.importance, immigrant_relevance: c?.immigrant_relevance, sensitive: c?.sensitive, story_key: c?.story_key })
      .eq("url", it.url);
    if (status !== "candidate" || !c) continue;
    if (seenKeys.has(c.story_key)) continue; // already covered in the last 48h
    const prev = bestByStory.get(c.story_key);
    if (!prev || s.priority > prev.s.priority) bestByStory.set(c.story_key, { it, c, s });
  }

  const chosen = [...bestByStory.values()]
    .sort((a, b) => score(b.c, b.s) - score(a.c, a.s))
    .slice(0, MAX_ARTICLES_PER_RUN);
  console.log(`${bestByStory.size} distinct stories, writing ${chosen.length}\n`);

  let written = 0;
  for (const { it, c, s } of chosen) {
    console.log(`→ [${s.nameEn}] ${it.title}`);
    const fullText = (await extractArticleText(it.url)) ?? it.content ?? "";
    const text = fullText.length > it.summary.length ? fullText : `${it.title}\n\n${it.summary}`;
    const mode = s.kind === "open" ? "translation" : "report";

    const important = c.importance >= 4 || c.immigrant_relevance >= 3;
    const model = important ? WRITER_MODEL_IMPORTANT : WRITER_MODEL;
    const article = await writeArticle({ model, mode, sourceName: s.nameEn, title: it.title, publishedAt: it.publishedAt, text });
    if (!article) {
      await db.from("raw_items").update({ status: "failed" }).eq("url", it.url);
      continue;
    }

    // Fully automatic by default: publish unless the writer only saw a headline/snippet.
    // With REQUIRE_REVIEW=true, uncertain or sensitive stories wait for a human instead.
    const status = REQUIRE_REVIEW
      ? c.sensitive || article.confidence !== "high" ? "pending_review" : "published"
      : article.confidence === "low" ? "rejected" : "published";
    const now = new Date().toISOString();
    const { data: inserted, error } = await db
      .from("articles")
      .insert({
        slug: await uniqueSlug(article.slug),
        title_fa: article.title_fa,
        summary_fa: article.summary_fa,
        body_fa: article.body_fa,
        category: c.category,
        tags: article.tags,
        immigrant_relevance: c.immigrant_relevance,
        importance: c.importance,
        mode,
        source_id: s.id,
        source_name: s.name,
        source_url: it.url,
        source_title: it.title,
        social: {
          telegram: article.telegram_post,
          x: article.x_post,
          instagram: article.instagram_caption,
          whatsapp: article.whatsapp_post,
        },
        confidence: article.confidence,
        notes_for_editor: article.notes_for_editor,
        status,
        published_at: status === "published" ? now : null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("  insert failed:", error.message);
      continue;
    }
    await db.from("raw_items").update({ status: "done", article_id: inserted.id }).eq("url", it.url);
    written++;
    console.log(`  ✓ ${status}: ${article.title_fa}`);
  }

  // Tell the website to refresh.
  const site = envOptional("SITE_URL");
  const secret = envOptional("REVALIDATE_SECRET");
  if (written && site && secret) {
    await fetch(`${site}/api/revalidate`, { method: "POST", headers: { authorization: `Bearer ${secret}` } }).catch(() => {});
  }
  console.log(`\nDone: ${written} articles written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
