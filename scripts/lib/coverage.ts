/**
 * "Hot story" counter. Every time another outlet (or the same outlet again) reports a story
 * we already published, the earlier article's counter goes up. Stored in articles.social.coverage
 * so no database change is needed. At HOT_AT reports the article gets the «خبر داغ» badge
 * and its importance goes up by one (so the home page favours it).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const HOT_AT = 3;
export type Coverage = { count: number; sources: string[]; boosted?: boolean };

export async function addCoverage(db: SupabaseClient, articleId: string, sourceName: string, reports = 1): Promise<void> {
  const { data } = await db.from("articles").select("social, source_name").eq("id", articleId).single();
  if (!data) return;
  const old = ((data.social ?? {}) as { coverage?: Coverage }).coverage ?? { count: 1, sources: [data.source_name].filter(Boolean) };
  await setCoverage(db, articleId, { ...old, count: old.count + reports, sources: [...old.sources, sourceName] });
}

/** Saves the counter; the first time a story reaches HOT_AT its importance goes up by one. */
export async function setCoverage(db: SupabaseClient, articleId: string, c: Coverage): Promise<void> {
  const { data } = await db.from("articles").select("social, importance").eq("id", articleId).single();
  if (!data) return;
  const social = (data.social ?? {}) as Record<string, unknown>;
  const prev = social.coverage as Coverage | undefined;
  const boost = c.count >= HOT_AT && !prev?.boosted;
  const coverage: Coverage = { count: c.count, sources: [...new Set(c.sources.filter(Boolean))], boosted: prev?.boosted || boost };
  await db
    .from("articles")
    .update({ social: { ...social, coverage }, ...(boost ? { importance: Math.min(5, (data.importance ?? 3) + 1) } : {}) })
    .eq("id", articleId);
  console.log(`  ▲ coverage ${coverage.count} (${coverage.sources.length} outlets)${boost ? " → hot" : ""}`);
}
