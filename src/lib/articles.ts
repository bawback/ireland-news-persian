import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Article } from "./types";
import { SAMPLE_ARTICLES } from "@/data/sample-articles";
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

const COLUMNS =
  "id, slug, title_fa, summary_fa, body_fa, category, tags, immigrant_relevance, importance, mode, source_name, source_url, source_title, image_url, image_credit, status, published_at, created_at";

function sample(filter: (a: Article) => boolean = () => true, limit = 50): Article[] {
  return SAMPLE_ARTICLES.filter(filter)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, limit);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Builder = any;

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
  if (isDemo) return sample((a) => a.category === category, limit);
  return query((q) => q.eq("category", category).order("published_at", { ascending: false }).limit(limit));
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
