import { getLatest } from "@/lib/articles";
import { SITE } from "@/lib/site";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const items = await getLatest(50);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${esc(SITE.name)}</title>
<link>${SITE.url}</link>
<description>${esc(SITE.description)}</description>
<language>fa</language>
${items
  .map(
    (a) => `<item>
<title>${esc(a.title_fa)}</title>
<link>${SITE.url}/news/${a.slug}</link>
<guid>${SITE.url}/news/${a.slug}</guid>
<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
<description>${esc(a.summary_fa)}</description>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
