import type { Region } from "./region";

export type ArticleMode = "translation" | "report";
export type ArticleStatus = "pending_review" | "published" | "rejected";

export interface Article {
  id: string;
  slug: string;
  title_fa: string;
  summary_fa: string;
  /** Persian body. Paragraphs separated by a blank line; "## " starts a subheading, "> " a quote, "- " a list item. */
  body_fa: string;
  category: string;
  tags: string[];
  /** 0 = not relevant to immigrants, 3 = very important for immigrants */
  immigrant_relevance: number;
  /** 1 (minor) to 5 (major) */
  importance: number;
  mode: ArticleMode;
  /** Feed id from scripts/sources.ts ("manual" for hand-picked stories). */
  source_id?: string | null;
  source_name: string;
  source_url: string;
  source_title: string;
  image_url?: string | null;
  image_credit?: string | null;
  /** Persian alt text for the picture (SEO and screen readers). */
  image_alt?: string | null;
  /** Social posts, how many reports of this story we saw (the «خبر داغ» badge) and where it happens (the «ایرلند شمالی» label). */
  social?: { coverage?: { count: number; sources: string[] }; region?: Region } | null;
  status: ArticleStatus;
  published_at: string;
  created_at: string;
}

/** At this many reports from the news feeds, a story is shown as «خبر داغ». */
export const HOT_AT = 3;
export const coverageOf = (a: Pick<Article, "social">) => a.social?.coverage?.count ?? 1;
export const isHot = (a: Pick<Article, "social">) => coverageOf(a) >= HOT_AT;
