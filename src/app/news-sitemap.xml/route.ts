import { getLatest } from "@/lib/articles";
import { SITE } from "@/lib/site";

/** Google News sitemap: only articles from the last two days, as Google asks. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const latest = await getLatest(200);
  const newest = latest[0] ? new Date(latest[0].published_at).getTime() : 0;
  // Measured from the newest article rather than "now", so the response can be cached.
  const recent = latest.filter((a) => newest - new Date(a.published_at).getTime() <= 48 * 3600_000);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recent
  .map(
    (a) => `<url>
<loc>${SITE.url}/news/${a.slug}</loc>
<news:news>
<news:publication><news:name>${esc(SITE.name)}</news:name><news:language>fa</news:language></news:publication>
<news:publication_date>${new Date(a.published_at).toISOString()}</news:publication_date>
<news:title>${esc(a.title_fa)}</news:title>
</news:news>
</url>`,
  )
  .join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
