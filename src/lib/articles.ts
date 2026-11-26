import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Article } from "./types";
import { SAMPLE_ARTICLES } from "@/data/sample-articles";
import { isNorthernIreland } from "./region";
import { cacheLife, cacheTag } from "next/cache";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True while no database is connected: the site then shows demo content. */
export const isDemo = !url || !anonKey;

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!client) client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  return client;
}

// "*" rather than a column list, so adding a column (e.g. image_alt) never breaks the site.
const COLUMNS = "*";

function sample(filter: (a: Article) => boolean = () => true, limit = 50): Article[] {
  return SAMPLE_ARTICLES.filter(filter)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

/**
 * Articles of one category page. The Northern Ireland page also lists Northern Ireland stories filed
 * under another topic (a Belfast court case, an Ulster Rugby match), which carry region "ni".
 */
const inCategory = (q: Builder, category: string): Builder =>
  category === "northern-ireland" ? q.or("category.eq.northern-ireland,social->>region.eq.ni") : q.eq("category", category);
const sampleInCategory = (category: string) => (a: Article) =>
  category === "northern-ireland" ? isNorthernIreland(a) : a.category === category;

async function query(build: (q: Builder) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Article[]> {
  const base: Builder = db().from("articles").select(COLUMNS).eq("status", "published");
  const { data, error } = await build(base);
  if (error) {
    console.error("Supabase query failed:", error.message);
    return [];
  }
  return (data as Article[] | null) ?? [];
}

export async function getLatest(limit = 30): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  if (isDemo) return sample(undefined, limit);
  return query((q) => q.order("published_at", { ascending: false }).limit(limit));
}

export async function getByCategory(category: string, limit = 30): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  if (isDemo) return sample(sampleInCategory(category), limit);
  return query((q) => inCategory(q, category).order("published_at", { ascending: false }).limit(limit));
}

/**
 * One page of the archive (all news, or one category), newest first. Fetches one extra row to know
 * whether a next page exists, so no count query is needed.
 */
export async function getArchivePage(
  page: number,
  perPage = 30,
  category?: string,
): Promise<{ articles: Article[]; hasNext: boolean }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  const from = (page - 1) * perPage;
  let rows: Article[];
  if (isDemo) {
    rows = sample(category ? sampleInCategory(category) : undefined, 10_000).slice(from, from + perPage + 1);
  } else {
    rows = await query((q) => {
      const base = category ? inCategory(q, category) : q;
      return base.order("published_at", { ascending: false }).range(from, from + perPage);
    });
  }
  return { articles: rows.slice(0, perPage), hasNext: rows.length > perPage };
}

export async function getImmigrantHighlights(limit = 6): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  if (isDemo) return sample((a) => a.immigrant_relevance >= 2, limit);
  return query((q) =>
    q.gte("immigrant_relevance", 2).order("published_at", { ascending: false }).limit(limit),
  );
}

export async function getBySlug(slug: string): Promise<Article | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  if (isDemo) return SAMPLE_ARTICLES.find((a) => a.slug === slug) ?? null;
  const rows = await query((q) => q.eq("slug", slug).limit(1));
  return rows[0] ?? null;
}

export async function getRelated(article: Article, limit = 4): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  const sameCategory = (await getByCategory(article.category, limit + 1)).filter((a) => a.id !== article.id);
  if (sameCategory.length >= 2) return sameCategory.slice(0, limit);
  const latest = (await getLatest(limit + 1)).filter((a) => a.id !== article.id);
  return latest.slice(0, limit);
}

export async function searchArticles(term: string, limit = 30): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  const t = term.trim();
  if (!t) return [];
  if (isDemo) {
    return sample((a) => a.title_fa.includes(t) || a.summary_fa.includes(t) || a.body_fa.includes(t), limit);
  }
  const safe = t.replace(/[%,()]/g, " ");
  return query((q) =>
    q
      .or(`title_fa.ilike.%${safe}%,summary_fa.ilike.%${safe}%`)
      .order("published_at", { ascending: false })
      .limit(limit),
  );
}

export type SitemapEntry = Pick<Article, "slug" | "published_at" | "category" | "image_url">;

/**
 * Every published article, light columns only, for the sitemap. Supabase returns at most 1000 rows per
 * request, so this reads in pages.
 */
export async function getSitemapEntries(max = 20_000): Promise<SitemapEntry[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  if (isDemo) return sample(undefined, max);
  const out: SitemapEntry[] = [];
  const size = 1000;
  for (let from = 0; from < max; from += size) {
    const { data, error } = await db()
      .from("articles")
      .select("slug,published_at,category,image_url")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, from + size - 1);
    if (error) {
      console.error("Supabase sitemap query failed:", error.message);
      break;
    }
    out.push(...((data as SitemapEntry[] | null) ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}
