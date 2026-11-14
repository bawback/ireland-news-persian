import { getImmigrantHighlights, getLatest } from "@/lib/articles";
import { ArticleCard, CompactItem, LeadCard } from "@/components/ArticleCard";
import { SectionTitle } from "@/components/SectionTitle";
import { SITE } from "@/lib/site";
import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import Link from "next/link";
import { GUIDES } from "@/content/guides";
import { coverageOf, type Article } from "@/lib/types";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    alternateName: SITE.nameEn,
    url: SITE.url,
    inLanguage: "fa",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE.url}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: SITE.name,
    alternateName: SITE.nameEn,
    url: SITE.url,
    logo: `${SITE.url}/brand/logo-1024.png`,
    sameAs: [SITE.telegram, SITE.instagram, SITE.x].filter(Boolean),
  },
];

/** Date (YYYY-MM-DD) and hour in Dublin for a moment in time. */
function dublin(t: number): { day: string; hour: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(t);
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return { day: `${v("year")}-${v("month")}-${v("day")}`, hour: Number(v("hour")) };
}

/**
 * The top story is the most important story of the news day: published between 07:00 and midnight
 * Dublin time. From midnight to 07:00 the previous day's top story stays. It changes as soon as a more
 * important story arrives. "Important" mostly means how many outlets reported it (the «خبر داغ» counter),
 * then the editor's importance score and relevance for immigrants. No fading by age within the day.
 */
function pickLead(articles: Article[]): Article | undefined {
  const now = Date.now();
  const today = dublin(now);
  const yesterday = dublin(now - 24 * 3600_000).day;
  const inDay = (day: string) =>
    articles.filter((a) => {
      const d = dublin(Date.parse(a.published_at));
      return d.day === day && d.hour >= 7;
    });
  let pool = today.hour >= 7 ? inDay(today.day) : [];
  if (!pool.length) pool = inDay(yesterday);
  if (!pool.length) pool = articles;
  const score = (a: Article) =>
    Math.min(coverageOf(a), 10) * 3 + a.importance * 2 + a.immigrant_relevance * 1 + (a.image_url ? 0.5 : 0);
  return [...pool].sort((x, y) => score(y) - score(x) || Date.parse(y.published_at) - Date.parse(x.published_at))[0];
}

export default async function HomePage() {
  "use cache";
  cacheLife("minutes");
  const [latest, immigrant] = await Promise.all([getLatest(80), getImmigrantHighlights(6)]);
  const lead = pickLead(latest);
  const rest = latest.filter((a) => a !== lead);
  const side = rest.slice(0, 5);
  const grid = rest.slice(5, 29);

  if (!lead) {
    return <p className="py-20 text-center text-muted">هنوز خبری منتشر نشده است.</p>;
  }

  return (
    <div className="space-y-12">
      <JsonLd data={siteJsonLd} />
      <h1 className="sr-only">{`${SITE.name}: خبرهای امروز ایرلند و ایرلند شمالی به زبان فارسی`}</h1>
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeadCard a={lead} />
        </div>
        <aside className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-1 font-black">تازه‌ترین‌ها</h2>
          {side.map((a) => (
            <CompactItem key={a.id} a={a} />
          ))}
        </aside>
      </section>

      {immigrant.length > 0 && (
        <section className="rounded-2xl bg-accent-soft p-5 sm:p-7">
          <SectionTitle title="مهم برای مهاجران" href="/category/immigration" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {immigrant.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="راهنماهای کاربردی" href="/guides" />
        <div className="grid gap-4 sm:grid-cols-2">
          {GUIDES.slice(0, 4).map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="rounded-2xl border border-line bg-surface p-5 transition hover:border-brand"
            >
              <h3 className="text-lg leading-8 font-black">{g.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-muted">{g.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {grid.length > 0 && (
        <section>
          <SectionTitle title="همه خبرها" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {SITE.telegram && (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
          <h2 className="text-xl font-black">خبرها را در تلگرام دنبال کنید</h2>
          <p className="text-muted">هر خبر مهم، همان لحظه در کانال تلگرام ما.</p>
          <a href={SITE.telegram} className="rounded-full bg-brand px-6 py-2.5 font-bold text-white hover:opacity-90">
            عضویت در کانال
          </a>
        </section>
      )}
    </div>
  );
}
