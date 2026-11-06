import { formatDayFa } from "@/lib/dates";
import { getEpisodes, PODCAST } from "@/lib/podcasts";
import { SITE } from "@/lib/site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const hms = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Podcast RSS feed (Apple Podcasts / Spotify compatible). */
export async function GET() {
  const episodes = await getEpisodes(100);
  const cover = `${SITE.url}/podcast-cover.jpg`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(PODCAST.name)} | ${esc(SITE.name)}</title>
<link>${SITE.url}/podcast</link>
<atom:link href="${SITE.url}/podcast.xml" rel="self" type="application/rss+xml"/>
<language>fa</language>
<description>${esc(PODCAST.tagline)}</description>
<itunes:author>${esc(SITE.name)}</itunes:author>
<itunes:summary>${esc(PODCAST.tagline)}</itunes:summary>
<itunes:image href="${cover}"/>
<image><url>${cover}</url><title>${esc(PODCAST.name)}</title><link>${SITE.url}/podcast</link></image>
<itunes:category text="News"><itunes:category text="Daily News"/></itunes:category>
<itunes:explicit>false</itunes:explicit>
<itunes:type>episodic</itunes:type>
${episodes
  .map(
    (e) => `<item>
<title>${esc(`${formatDayFa(e.episode_date)} | ${e.title}`)}</title>
<description>${esc(e.description)}</description>
<link>${SITE.url}/podcast</link>
<guid isPermaLink="false">${e.id}</guid>
<pubDate>${new Date(e.created_at).toUTCString()}</pubDate>
<enclosure url="${esc(e.audio_url)}" length="${e.size_bytes}" type="audio/mpeg"/>
<itunes:duration>${hms(e.duration_sec)}</itunes:duration>
<itunes:explicit>false</itunes:explicit>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
