import type { MetadataRoute } from "next";
import { getLatest } from "@/lib/articles";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";
import { GUIDES } from "@/content/guides";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getLatest(1000);
  return [
    { url: SITE.url, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE.url}/podcast`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE.url}/guides`, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({ url: `${SITE.url}/guides/${g.slug}`, lastModified: g.updated, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...CATEGORIES.map((c) => ({ url: `${SITE.url}/category/${c.slug}`, changeFrequency: "hourly" as const })),
    ...articles.map((a) => ({
      url: `${SITE.url}/news/${a.slug}`,
      lastModified: a.published_at,
      ...(a.image_url ? { images: [a.image_url] } : {}),
    })),
  ];
}
