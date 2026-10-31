import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBySlug, getLatest, getRelated } from "@/lib/articles";
import { categoryName } from "@/lib/categories";
import { formatFaDateTime } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { ArticleBody } from "@/components/ArticleBody";
import { BidiText } from "@/components/BidiText";
import { ShareButtons } from "@/components/ShareButtons";
import { CompactItem } from "@/components/ArticleCard";
import { cacheLife } from "next/cache";

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const a = await getBySlug(slug);
  if (!a) return {};
  return {
    title: a.title_fa,
    description: a.summary_fa,
    alternates: { canonical: `/news/${a.slug}` },
    openGraph: { type: "article", title: a.title_fa, description: a.summary_fa, publishedTime: a.published_at },
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: a.title_fa,
    description: a.summary_fa,
    datePublished: a.published_at,
    inLanguage: "fa",
    mainEntityOfPage: url,
    publisher: { "@type": "Organization", name: SITE.name },
    ...(a.source_url ? { isBasedOn: a.source_url } : {}),
  };

  return (
    <div className="grid gap-10 lg:grid-cols-3">
      <article className="lg:col-span-2">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <nav className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-brand">خانه</Link>
          <span className="mx-2">/</span>
          <Link href={`/category/${a.category}`} className="hover:text-brand">{categoryName(a.category)}</Link>
        </nav>

        <h1 className="text-[1.9rem] leading-[1.7] font-black sm:text-[2.4rem]">
          <BidiText text={a.title_fa} />
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <time dateTime={a.published_at}>{formatFaDateTime(a.published_at)} (به وقت دوبلین)</time>
          {a.immigrant_relevance >= 2 && (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">مهم برای مهاجران</span>
          )}
        </div>

        <p className="mt-6 rounded-xl border-s-4 border-brand bg-brand-soft p-5 text-lg leading-9 font-medium">
          <BidiText text={a.summary_fa} />
        </p>

        <div className="mt-6">
          <ArticleBody body={a.body_fa} />
        </div>

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
          </div>
        )}
      </aside>
    </div>
  );
}
