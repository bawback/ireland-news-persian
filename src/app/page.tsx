import { getImmigrantHighlights, getLatest } from "@/lib/articles";
import { ArticleCard, CompactItem, LeadCard } from "@/components/ArticleCard";
import { SectionTitle } from "@/components/SectionTitle";
import { LD_IDS, SITE, organizationLd } from "@/lib/site";
import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import Link from "next/link";
import { GUIDES } from "@/content/guides";
import { coverageOf, type Article } from "@/lib/types";

export const metadata: Metadata = {
  title: { absolute: SITE.homeTitle },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", url: "/", title: SITE.homeTitle, description: SITE.description },
};

const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": LD_IDS.website,
      name: SITE.name,
      alternateName: SITE.alternateNames,
      url: SITE.url,
      description: SITE.description,
      inLanguage: "fa",
      publisher: { "@id": LD_IDS.org },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    organizationLd(),
    {
      "@type": "WebPage",
      "@id": `${SITE.url}/#webpage`,
      url: SITE.url,
      name: SITE.homeTitle,
      description: SITE.description,
      inLanguage: "fa",
      isPartOf: { "@id": LD_IDS.website },
      about: [
        { "@type": "Country", name: "Ireland", alternateName: "ایرلند", sameAs: "https://en.wikipedia.org/wiki/Republic_of_Ireland" },
        { "@type": "Place", name: "Northern Ireland", alternateName: "ایرلند شمالی", sameAs: "https://en.wikipedia.org/wiki/Northern_Ireland" },
      ],
      publisher: { "@id": LD_IDS.org },
    },
  ],
};

/** Keyword links to the topic pages, shown in the "about" block at the bottom of the home page. */
const TOPIC_LINKS: { href: string; text: string }[] = [
  { href: "/category/ireland", text: "اخبار ایرلند امروز" },
  { href: "/category/immigration", text: "اخبار مهاجرت ایرلند" },
  { href: "/category/economy", text: "اخبار اقتصادی ایرلند" },
  { href: "/category/housing", text: "اخبار مسکن و اجاره در ایرلند" },
  { href: "/category/northern-ireland", text: "اخبار ایرلند شمالی" },
  { href: "/category/politics", text: "اخبار سیاسی ایرلند" },
  { href: "/category/law", text: "قوانین تازه ایرلند" },
  { href: "/category/sport", text: "اخبار ورزشی ایرلند" },
  { href: "/category/culture", text: "اخبار فرهنگی ایرلند" },
  { href: "/category/community", text: "اخبار ایرانیان ایرلند" },
  { href: "/guides", text: "راهنمای زندگی و مهاجرت به ایرلند" },
  { href: "/news", text: "آرشیو همه اخبار ایرلند" },
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
      <div className="space-y-4">
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-black sm:text-2xl">اخبار ایرلند به فارسی</h1>
          <p className="text-sm text-muted">تازه‌ترین اخبار امروز ایرلند، دابلین و ایرلند شمالی از منابع معتبر</p>
        </header>
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
      </div>

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
          <SectionTitle title="همه اخبار ایرلند" href="/news" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grid.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <h2 className="text-xl leading-9 font-black">اخبار ایرلند به زبان فارسی، از منابع معتبر</h2>
        <p className="mt-3 leading-8 text-muted">
          «{SITE.name}» هر روز اخبار ایرلند و ایرلند شمالی را از منابع رسمی و رسانه‌های معتبر ایرلندی جمع می‌کند و به
          فارسی روان و دقیق منتشر می‌کند؛ از سیاست و اقتصاد، بازار کار و مسکن تا ورزش و فرهنگ. تمرکز ویژه ما بر خبرهایی
          است که برای مهاجران و ایرانیان مقیم ایرلند مهم است: ویزا و اقامت، قوانین تازه، هزینه زندگی و حقوق کار. منبع هر
          خبر زیر همان خبر آمده است.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2 text-sm">
          {TOPIC_LINKS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="inline-block rounded-full bg-brand-soft px-3 py-1.5 font-semibold text-brand hover:opacity-80">
                {t.text}
              </Link>
            </li>
          ))}
        </ul>
      </section>

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
