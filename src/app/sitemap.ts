import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/articles";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";
import { GUIDES } from "@/content/guides";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getSitemapEntries();
  const newest = articles[0]?.published_at;
  // Each topic page changes when its newest article is published.
  const newestIn = (slug: string) => articles.find((a) => a.category === slug)?.published_at ?? newest;
  return [
    { url: SITE.url, lastModified: newest, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/news`, lastModified: newest, changeFrequency: "hourly", priority: 0.9 },
    ...CATEGORIES.map((c) => ({
      url: `${SITE.url}/category/${c.slug}`,
      lastModified: newestIn(c.slug),
      changeFrequency: "hourly" as const,
      priority: c.slug === "ireland" || c.slug === "immigration" ? 0.9 : 0.8,
    })),
    { url: `${SITE.url}/guides`, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({ url: `${SITE.url}/guides/${g.slug}`, lastModified: g.updated, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...articles.map((a) => ({
      url: `${SITE.url}/news/${a.slug}`,
      lastModified: a.published_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      ...(a.image_url ? { images: [a.image_url] } : {}),
    })),
    { url: `${SITE.url}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE.url}/advertise`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
