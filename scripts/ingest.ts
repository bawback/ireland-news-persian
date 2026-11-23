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
import { checkNovelty, classifyItems, cleanArticle, writeArticle, WRITER_MODEL, WRITER_MODEL_IMPORTANT, type Classification } from "./lib/ai";
import { adminDb } from "./lib/db";
import { envBool, envInt } from "./lib/env";
import { refreshSite } from "./lib/revalidate";
import { addCoverage } from "./lib/coverage";
import { onRteRadio, rteMostRead } from "./lib/trending";

const MAX_AGE_HOURS = envInt("MAX_AGE_HOURS", 36);
const MAX_ARTICLES_PER_RUN = envInt("MAX_ARTICLES_PER_RUN", 3);
const MIN_IMPORTANCE = envInt("MIN_IMPORTANCE", 3);
// Fun lane: light stories (events, concerts, quirky news) are chosen separately, so they
// never push out important news and are not filtered out by MIN_IMPORTANCE.
const MAX_FUN_PER_RUN = envInt("MAX_FUN_PER_RUN", 1);
const MIN_FUN_APPEAL = envInt("MIN_FUN_APPEAL", 2);
const isFun = (c: Classification) => c.category === "entertainment" && c.fun_appeal >= MIN_FUN_APPEAL;
const REQUIRE_REVIEW = envBool("REQUIRE_REVIEW", false); // false = fully automatic publishing
// Hot lane: stories Ireland is arguing about (a public row, RTÉ's Most Read, debated on RTÉ Radio 1)
// are always followed. A new turn in such a story (the minister's defence, a legal challenge,
// opposition demands) gets its own follow-up article in extra slots, instead of being dropped as
// "already covered". At most one follow-up per story every HOT_UPDATE_GAP_HOURS.
const MAX_HOT_UPDATES_PER_RUN = envInt("MAX_HOT_UPDATES_PER_RUN", 1);
const HOT_UPDATE_GAP_HOURS = envInt("HOT_UPDATE_GAP_HOURS", 3);
const MOST_READ_TOP = envInt("MOST_READ_TOP", 10);

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
    const { data, error } = await db.from("raw_items").select("url, status").in("url", urls);
    if (error) throw error;
    // Items still "new" were never classified (e.g. an earlier run failed), so retry them.
    data?.forEach((r) => r.status !== "new" && seen.add(r.url));
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

// How far back we look for "already covered" stories.
const DEDUP_HOURS = envInt("DEDUP_HOURS", 96);

/** story_key → the article written for it, for stories covered recently. */
async function recentStoryKeys(): Promise<Map<string, string>> {
  const since = new Date(Date.now() - DEDUP_HOURS * 3600_000).toISOString();
  const { data } = await db.from("raw_items").select("story_key, article_id").eq("status", "done").gte("created_at", since);
  return new Map((data ?? []).filter((r) => r.story_key && r.article_id).map((r) => [r.story_key, r.article_id]));
}

type Covered = { id: string; source_title: string; title_fa: string; summary_fa: string; created_at: string };
async function recentArticles(): Promise<Covered[]> {
  const since = new Date(Date.now() - DEDUP_HOURS * 3600_000).toISOString();
  const { data } = await db
    .from("articles")
    .select("id, source_title, title_fa, summary_fa, created_at")
    .eq("status", "published")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(150);
  return (data ?? []).filter((r) => r.source_title || r.title_fa) as Covered[];
}

// Words too common in Irish headlines to say anything about which story it is.
const COMMON = new Set(
  "ireland irish dublin says said after over will with from that this have been year years people government new more than about into could would their they what when where which while amid".split(" "),
);
function titleWords(t: string): Set<string> {
  return new Set(t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !COMMON.has(w)));
}
/** Two headlines about the same event, even when the classifier gave them different story keys. */
function sameStory(a: string, b: string): boolean {
  const wa = titleWords(a);
  const wb = titleWords(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared >= 3 || (shared >= 2 && shared / Math.min(wa.size, wb.size) >= 0.5);
}

/** Signals that people in Ireland are talking about a story right now. */
type Heat = { mostRead?: number; radio: boolean };
const heatOf = new Map<string, Heat>(); // by item URL

function isHot(c: Classification, h: Heat | undefined): boolean {
  if (c.category === "entertainment") return false;
  return c.controversy >= 2 || (!!h?.mostRead && h.mostRead <= MOST_READ_TOP && c.importance >= 3) || (!!h?.radio && c.controversy >= 1);
}

function score(c: Classification, s: Source, h?: Heat) {
  const trending = h?.mostRead ? Math.max(0, (MOST_READ_TOP + 1 - h.mostRead) / 3) : 0;
  return c.importance * 2 + c.immigrant_relevance * 2 + s.priority / 5 + c.controversy * 1.5 + trending + (h?.radio ? 1 : 0);
}

async function uniqueSlug(base: string): Promise<string> {
  const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "news";
  const { data } = await db.from("articles").select("id").eq("slug", clean).limit(1);
  return data && data.length ? `${clean}-${hash(clean + Date.now())}` : clean;
}

async function main() {
  const [all, mostRead] = await Promise.all([readAllFeeds(), rteMostRead()]);
  console.log(`RTÉ Most Read: ${mostRead.size} stories`);
  for (const it of all) heatOf.set(it.url, { mostRead: mostRead.get(it.url), radio: onRteRadio(`${it.title} ${it.summary} ${it.content}`) });
  const fresh = await filterUnseen(all);
  console.log(`\n${all.length} items in feeds, ${fresh.length} new`);
  if (!fresh.length) return;

  // Remember every new item so we never pay to process it twice.
  const { error: insErr } = await db.from("raw_items").upsert(
    fresh.map((it) => ({
      url: it.url,
      source_id: it.sourceId,
      title: it.title,
      summary: it.summary.slice(0, 2000),
      published_at: it.publishedAt,
      status: "new",
    })),
    { onConflict: "url" },
  );
  if (insErr) throw insErr;

  const classes = await classifyAll(fresh);
  const seenKeys = await recentStoryKeys();

  // Pick the best item for each story.
  const bestByStory = new Map<string, { it: FeedItem; c: Classification; s: Source }>();
  const sameKeyCount = new Map<string, number>(); // reports of each story in this run
  for (const it of fresh) {
    const c = classes.get(it.url);
    if (!c) continue; // not classified this time; stays "new" and is retried next run
    const s = sourceById.get(it.sourceId)!;
    const hot = isHot(c, heatOf.get(it.url));
    const status = c.relevant && (c.importance >= MIN_IMPORTANCE || isFun(c) || hot) ? "candidate" : "skipped";
    await db
      .from("raw_items")
      .update({ status, category: c.category, importance: c.importance, immigrant_relevance: c.immigrant_relevance, sensitive: c.sensitive, story_key: c.story_key })
      .eq("url", it.url);
    if (status !== "candidate") continue;
    const coveredBy = seenKeys.get(c.story_key);
    // A hot story already covered goes on to the novelty check, which decides if it is a follow-up.
    if (coveredBy && !hot) {
      // Already covered recently: count it as one more report of that story.
      await db.from("raw_items").update({ status: "duplicate" }).eq("url", it.url);
      await addCoverage(db, coveredBy, s.nameEn);
      continue;
    }
    const prev = bestByStory.get(c.story_key);
    sameKeyCount.set(c.story_key, (sameKeyCount.get(c.story_key) ?? 0) + 1);
    if (!prev || score(c, s, heatOf.get(it.url)) > score(prev.c, prev.s, heatOf.get(prev.it.url))) bestByStory.set(c.story_key, { it, c, s });
  }

  const coveredArticles = await recentArticles();
  const covered = coveredArticles.map((a) => a.source_title).filter(Boolean);
  type Cand = { it: FeedItem; c: Classification; s: Source; hot?: boolean; updateOf?: { title_fa: string; new_facts: string } };
  const hotOf = (x: { it: FeedItem; c: Classification }) => isHot(x.c, heatOf.get(x.it.url));
  const all_ = [...bestByStory.values()];

  // Shortlist by score (cheap word-overlap filter first), then ask the model which ones are
  // really new: the same story from another outlet, or a reaction/review/analysis of a story
  // we already published, is a duplicate. Only a major new development counts as an update.
  const pool: Cand[] = [];
  const quickNew = (title: string, hot = false) =>
    (hot || !covered.some((t) => sameStory(t, title))) && !pool.some((x) => sameStory(x.it.title, title));
  // Headline clearly matches an article we published: count it as one more report.
  for (const cand of all_) {
    if (hotOf(cand)) continue; // hot: the novelty check decides
    const match = coveredArticles.find((a) => a.source_title && sameStory(a.source_title, cand.it.title));
    if (match) {
      await db.from("raw_items").update({ status: "duplicate" }).eq("url", cand.it.url);
      await addCoverage(db, match.id, cand.s.nameEn);
    }
  }
  const newsRanked = all_.filter((x) => x.c.category !== "entertainment").sort((a, b) => score(b.c, b.s, heatOf.get(b.it.url)) - score(a.c, a.s, heatOf.get(a.it.url)));
  const funScore = (x: { c: Classification; s: Source }) => x.c.fun_appeal * 3 + x.c.importance + x.s.priority / 5;
  const funRanked = all_.filter((x) => isFun(x.c)).sort((a, b) => funScore(b) - funScore(a));
  for (const cand of newsRanked) {
    const hot = hotOf(cand);
    if (pool.length < (MAX_ARTICLES_PER_RUN + MAX_HOT_UPDATES_PER_RUN) * 4 && quickNew(cand.it.title, hot)) pool.push({ ...cand, hot });
  }
  const newsInPool = pool.length;
  for (const cand of funRanked) if (pool.length < newsInPool + MAX_FUN_PER_RUN * 4 && quickNew(cand.it.title)) pool.push(cand);

  const verdicts = await checkNovelty(
    coveredArticles.map((a, index) => ({ index, source_title: a.source_title, title_fa: a.title_fa })),
    pool.map((x, index) => ({ index, title: x.it.title, summary: x.it.summary.slice(0, 300), ...(x.hot ? { hot: true } : {}) })),
  );
  if (!verdicts) console.warn("novelty check unavailable; using the headline-overlap check only");

  const chosen: Cand[] = [];
  let n = 0;
  let f = 0;
  let h = 0;
  const followed = new Set<string>(); // earlier articles that got a follow-up in this run
  for (const [i, cand] of pool.entries()) {
    const fun = cand.c.category === "entertainment";
    const v = verdicts?.get(i);
    // Light stories never get "updates": one article per show, gig or quirky story is enough.
    if (v && (v.verdict === "duplicate" || (v.verdict === "update" && fun))) {
      console.log(`  ⨯ duplicate: ${cand.it.title}${v.same_as >= 0 ? `  (= ${coveredArticles[v.same_as]?.source_title})` : ""}`);
      await db.from("raw_items").update({ status: "duplicate" }).eq("url", cand.it.url);
      const old = coveredArticles[v.same_as];
      if (old) await addCoverage(db, old.id, cand.s.nameEn);
      continue;
    }
    const hotUpdate = v?.verdict === "update" && !!cand.hot;
    if (hotUpdate ? h >= MAX_HOT_UPDATES_PER_RUN : fun ? f >= MAX_FUN_PER_RUN : n >= MAX_ARTICLES_PER_RUN) continue;
    if (v?.verdict === "update") {
      const old = coveredArticles[v.same_as];
      if (!old || !v.new_facts.trim() || followed.has(old.id)) continue;
      if (hotUpdate && Date.now() - new Date(old.created_at).getTime() < HOT_UPDATE_GAP_HOURS * 3600_000) {
        console.log(`  … hot follow-up waits (last article on it is under ${HOT_UPDATE_GAP_HOURS}h old): ${cand.it.title}`);
        await db.from("raw_items").update({ status: "new" }).eq("url", cand.it.url); // look at it again next run
        continue;
      }
      followed.add(old.id);
      cand.updateOf = { title_fa: old.title_fa, new_facts: v.new_facts };
      await addCoverage(db, old.id, cand.s.nameEn);
      console.log(`  ↻ update: ${cand.it.title} — ${v.new_facts}`);
    }
    chosen.push(cand);
    if (hotUpdate) h++;
    else if (fun) f++;
    else n++;
  }
  console.log(`${bestByStory.size} distinct stories, writing ${chosen.length}\n`);

  let written = 0;
  const publishedPaths: string[] = [];
  for (const { it, c, s, updateOf } of chosen) {
    console.log(`→ [${s.nameEn}] ${it.title}`);
    const fullText = (await extractArticleText(it.url)) ?? it.content ?? "";
    const text = fullText.length > it.summary.length ? fullText : `${it.title}\n\n${it.summary}`;
    const mode = s.kind === "open" ? "translation" : "report";

    const important = c.importance >= 4 || c.immigrant_relevance >= 3;
    const model = important ? WRITER_MODEL_IMPORTANT : WRITER_MODEL;
    const written_ = await writeArticle({ model, mode, sourceName: s.nameEn, title: it.title, publishedAt: it.publishedAt, text, light: c.category === "entertainment", updateOf });
    const article = written_ && (await cleanArticle(written_));
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
      .select("id, slug")
      .single();
    if (error) {
      console.error("  insert failed:", error.message);
      continue;
    }
    await db.from("raw_items").update({ status: "done", article_id: inserted.id }).eq("url", it.url);
    const others = (sameKeyCount.get(c.story_key) ?? 1) - 1;
    if (others > 0) await addCoverage(db, inserted.id, "", others);
    written++;
    if (status === "published") publishedPaths.push(`/news/${inserted.slug}`, `/category/${c.category}`);
    console.log(`  ✓ ${status}: ${article.title_fa}`);
  }

  // Tell the website to refresh.
  if (written) await refreshSite(publishedPaths);
  console.log(`\nDone: ${written} articles written.`);
}

// Exit explicitly: open HTTP keep-alive sockets otherwise hold the job for minutes.
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
