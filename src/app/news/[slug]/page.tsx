import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBySlug, getLatest, getRelated } from "@/lib/articles";
import { categoryName, getCategory } from "@/lib/categories";
import { formatFaDateTime } from "@/lib/dates";
import { coverageOf, isHot } from "@/lib/types";
import { LD_IDS, LOGO_URL, SITE } from "@/lib/site";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const categoryHeading = (slug: string) => getCategory(slug)?.heading ?? "اخبار ایرلند";
import { ArticleBody } from "@/components/ArticleBody";
import { BidiText } from "@/components/BidiText";
import { ShareButtons } from "@/components/ShareButtons";
import { TelegramCta } from "@/components/TelegramCta";
import { CompactItem } from "@/components/ArticleCard";
import { JsonLd } from "@/components/JsonLd";
import { cacheLife } from "next/cache";

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getBySlug(slug);
  // Throwing here (before the page starts streaming) makes the response a real 404, not a 200.
  if (!a) notFound();
  return {
    title: a.title_fa,
    description: a.summary_fa.length > 300 ? `${a.summary_fa.slice(0, 297)}…` : a.summary_fa,
    keywords: [...a.tags, "اخبار ایرلند", categoryHeading(a.category)],
    alternates: { canonical: `/news/${a.slug}` },
    authors: [{ name: SITE.name, url: SITE.url }],
    openGraph: {
      type: "article",
      url: `/news/${a.slug}`,
      title: a.title_fa,
      description: a.summary_fa,
      authors: [SITE.url],
      publishedTime: a.published_at,
      modifiedTime: a.published_at,
      section: categoryName(a.category),
      tags: a.tags,
      images: a.image_url
        ? [{ url: a.image_url, width: 1200, height: 675, alt: a.image_alt || a.title_fa }]
        : ["/opengraph-image.png"],
    },
  };
}

export async function generateStaticParams() {
  const latest = await getLatest(50);
  // Cache Components needs at least one entry at build time, even before any news exists.
  return latest.length ? latest.map((a) => ({ slug: a.slug })) : [{ slug: "welcome" }];
}

export default function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <ArticleLoader params={params} />
    </Suspense>
  );
}

function ArticleSkeleton() {
  return (
    <div className="animate-pulse space-y-4 lg:w-2/3">
      <div className="h-10 rounded bg-line" />
      <div className="h-10 w-2/3 rounded bg-line" />
      <div className="h-32 rounded bg-line" />
    </div>
  );
}

async function ArticleLoader({ params }: { params: PageProps<"/news/[slug]">["params"] }) {
  const { slug } = await params;
  return <ArticleView slug={slug} />;
}

async function ArticleView({ slug }: { slug: string }) {
  "use cache";
  cacheLife("minutes");
  const a = await getBySlug(slug);
  if (!a) notFound();
  const related = await getRelated(a);
  const url = `${SITE.url}/news/${a.slug}`;

  const place =
    a.category === "northern-ireland"
      ? { "@type": "Place", name: "Northern Ireland", alternateName: "ایرلند شمالی" }
      : { "@type": "Country", name: "Ireland", alternateName: "ایرلند" };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${url}#article`,
    headline: a.title_fa.slice(0, 110),
    description: a.summary_fa,
    datePublished: a.published_at,
    dateModified: a.published_at,
    inLanguage: "fa",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    image: a.image_url
      ? [
          {
            "@type": "ImageObject",
            url: a.image_url,
            width: 1200,
            height: 675,
            caption: a.image_alt || a.title_fa,
            ...(a.image_credit ? { creditText: a.image_credit } : {}),
          },
        ]
      : [`${SITE.url}/opengraph-image.png`],
    thumbnailUrl: a.image_url || `${SITE.url}/opengraph-image.png`,
    articleSection: categoryName(a.category),
    keywords: a.tags.join(", "),
    wordCount: a.body_fa.split(/\s+/).filter(Boolean).length,
    isAccessibleForFree: true,
    contentLocation: place,
    spatialCoverage: place,
    author: { "@type": "Organization", "@id": LD_IDS.org, name: SITE.name, url: `${SITE.url}/about` },
    publisher: {
      "@type": "NewsMediaOrganization",
      "@id": LD_IDS.org,
      name: SITE.name,
      url: SITE.url,
      logo: { "@type": "ImageObject", url: LOGO_URL, width: 1024, height: 1024 },
    },
    isPartOf: { "@id": LD_IDS.website },
    ...(a.source_url
      ? { isBasedOn: { "@type": "NewsArticle", url: a.source_url, ...(a.source_title ? { name: a.source_title } : {}), publisher: { "@type": "Organization", name: a.source_name } } }
      : {}),
  };

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <article className="lg:col-span-2">
        <JsonLd data={jsonLd} />
        <Breadcrumbs
          items={[
            { name: categoryHeading(a.category), href: `/category/${a.category}` },
            { name: a.title_fa, href: `/news/${a.slug}` },
          ]}
        />

        <h1 className="text-[1.9rem] leading-[1.7] font-black sm:text-[2.4rem]">
          <BidiText text={a.title_fa} />
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <time dateTime={a.published_at}>{formatFaDateTime(a.published_at)} (به وقت دوبلین)</time>
          {a.immigrant_relevance >= 2 && (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">مهم برای مهاجران</span>
          )}
          {isHot(a) && (
            <span className="rounded-full bg-hot-soft px-2.5 py-0.5 font-semibold text-hot">
              🔥 خبر داغ: {coverageOf(a).toLocaleString("fa-IR")} گزارش
              {(a.social?.coverage?.sources.length ?? 0) > 1 &&
                ` از ${a.social!.coverage!.sources.length.toLocaleString("fa-IR")} رسانه`}
            </span>
          )}
        </div>

        {a.image_url && (
          <figure className="mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.image_url}
              alt={a.image_alt || a.title_fa}
              title={a.image_alt || a.title_fa}
              width={1200}
              height={675}
              fetchPriority="high"
              className="aspect-video w-full rounded-xl object-cover"
            />
            {a.image_credit && <figcaption className="mt-2 text-xs text-muted">{a.image_credit}</figcaption>}
          </figure>
        )}

        <p className="mt-6 rounded-xl border-s-4 border-brand bg-brand-soft p-5 text-lg leading-9 font-medium">
          <BidiText text={a.summary_fa} />
        </p>

        <div className="mt-6">
          <ArticleBody body={a.body_fa} />
        </div>

        <TelegramCta />

        <footer className="mt-10 space-y-4 rounded-xl border border-line bg-surface p-5 text-sm leading-7">
          {a.source_url ? (
            <p>
              <span className="font-bold">منبع: </span>
              <a href={a.source_url} target="_blank" rel="noopener" className="text-brand hover:underline">
                {a.source_name}
                {a.source_title && (
                  <>
                    {" — "}
                    <bdi dir="ltr">{a.source_title}</bdi>
                  </>
                )}
              </a>
            </p>
          ) : (
            <p><span className="font-bold">منبع: </span>{a.source_name}</p>
          )}
          <p className="text-muted">
            {a.mode === "translation"
              ? "این متن ترجمه کامل منبع رسمی بالاست که با کمک هوش مصنوعی ترجمه و توسط تحریریه بازبینی شده است."
              : "این گزارش بر اساس خبر منبع بالا به فارسی نوشته شده است. برای متن کامل اصلی به لینک منبع مراجعه کنید."}
          </p>
          <ShareButtons url={url} title={a.title_fa} />
        </footer>
      </article>

      <aside className="space-y-6">
        {related.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface p-5 lg:sticky lg:top-36">
            <h2 className="mb-1 font-black">خبرهای دیگر</h2>
            {related.map((r) => (
              <CompactItem key={r.id} a={r} />
            ))}
            <Link href={`/category/${a.category}`} className="mt-3 inline-block text-sm font-bold text-brand hover:underline">
              همه {categoryHeading(a.category)} ←
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
