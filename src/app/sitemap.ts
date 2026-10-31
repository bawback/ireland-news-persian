import type { MetadataRoute } from "next";
import { getLatest } from "@/lib/articles";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getLatest(1000);
  return [
    { url: SITE.url, changeFrequency: "hourly", priority: 1 },
    ...CATEGORIES.map((c) => ({ url: `${SITE.url}/category/${c.slug}`, changeFrequency: "hourly" as const })),
    ...articles.map((a) => ({ url: `${SITE.url}/news/${a.slug}`, lastModified: a.published_at })),
  ];
}
