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

/**
 * The big story at the top: the most important and most talked-about story of the last day,
 * not simply the newest. Importance, relevance for immigrants and how many outlets reported it
 * (the «خبر داغ» counter) count most; a picture and freshness help; older stories slowly fade.
 */
function pickLead(articles: Article[]): Article | undefined {
  const now = Date.now();
  const recent = articles.filter((a) => now - Date.parse(a.published_at) < 24 * 3600_000);
  const pool = recent.length >= 3 ? recent : articles;
  const score = (a: Article) => {
    const hours = (now - Date.parse(a.published_at)) / 3600_000;
    return (
      a.importance * 2 +
      a.immigrant_relevance * 1.5 +
      Math.min(coverageOf(a), 6) * 1.5 +
      (a.image_url ? 1 : 0) -
      hours / 8
    );
  };
  return [...pool].sort((x, y) => score(y) - score(x))[0];
}

export default async function HomePage() {
  "use cache";
  cacheLife("minutes");
  const [latest, immigrant] = await Promise.all([getLatest(30), getImmigrantHighlights(6)]);
  const lead = pickLead(latest);
  const rest = latest.filter((a) => a !== lead);
  const side = rest.slice(0, 5);
  const grid = rest.slice(5);

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
