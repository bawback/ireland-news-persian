import Parser from "rss-parser";
import type { Source } from "../sources";

export interface FeedItem {
  sourceId: string;
  url: string;
  title: string;
  summary: string;
  content: string;
  publishedAt: string;
}

const parser = new Parser({
  timeout: 20_000,
  headers: { "User-Agent": "IrelandNewsPersianBot/1.0 (+https://github.com)" },
});

const strip = (html = "") =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Remove tracking parameters so the same article is not stored twice. */
export function normaliseUrl(u: string): string {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ito|cmpid|ref)/i.test(k)) url.searchParams.delete(k);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

export async function fetchFeed(source: Source, maxAgeHours: number): Promise<FeedItem[]> {
  const feed = await parser.parseURL(source.feed);
  const cutoff = Date.now() - maxAgeHours * 3600_000;
  return (feed.items ?? [])
    .map((it) => ({
      sourceId: source.id,
      url: normaliseUrl(it.link ?? ""),
      title: strip(it.title),
      summary: strip(it.contentSnippet ?? it.summary ?? it.content ?? ""),
      content: strip((it as { "content:encoded"?: string })["content:encoded"] ?? it.content ?? ""),
      publishedAt: new Date(it.isoDate ?? it.pubDate ?? Date.now()).toISOString(),
    }))
    .filter((it) => it.url && it.title && new Date(it.publishedAt).getTime() >= cutoff);
}
