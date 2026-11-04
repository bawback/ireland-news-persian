import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/content/guides";
import { formatFaDate, formatGregorianFa } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { ArticleBody } from "@/components/ArticleBody";
import { BidiText } from "@/components/BidiText";
import { JsonLd } from "@/components/JsonLd";
import { ShareButtons } from "@/components/ShareButtons";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) return {};
  return {
    title: { absolute: g.seoTitle },
    description: g.description,
    keywords: g.keywords,
    alternates: { canonical: `/guides/${g.slug}` },
    openGraph: {
      type: "article",
      title: g.title,
      description: g.description,
      publishedTime: g.published,
      modifiedTime: g.updated,
      tags: g.keywords,
      images: ["/opengraph-image.png"],
    },
  };
}

/** Pulls the "## Heading {#anchor}" lines out of the body for the table of contents. */
function toc(body: string) {
  return [...body.matchAll(/^## (.+?)\s*\{#([a-z0-9-]+)\}\s*$/gm)].map((m) => ({ text: m[1], id: m[2] }));
}

const plain = (s: string) => s.replace(/\*\*/g, "");

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();
  const url = `${SITE.url}/guides/${g.slug}`;
  const logo = `${SITE.url}/brand/logo-1024.png`;

  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title.slice(0, 110),
    description: g.description,
    datePublished: g.published,
    dateModified: g.updated,
    inLanguage: "fa",
    mainEntityOfPage: url,
    url,
    image: [`${SITE.url}/opengraph-image.png`],
    keywords: g.keywords.join(", "),
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "NewsMediaOrganization", name: SITE.name, url: SITE.url, logo: { "@type": "ImageObject", url: logo } },
    citation: g.sources.map((s) => s.url),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: g.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "خانه", item: SITE.url },
      { "@type": "ListItem", position: 2, name: "راهنماها", item: `${SITE.url}/guides` },
      { "@type": "ListItem", position: 3, name: g.title, item: url },
    ],
  };

  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={article} />
      <JsonLd data={faq} />
      <JsonLd data={breadcrumbs} />

      <nav className="mb-4 text-sm text-muted">
        <Link href="/" className="hover:text-brand">خانه</Link>
        <span className="mx-2">/</span>
        <Link href="/guides" className="hover:text-brand">راهنماها</Link>
      </nav>

      <h1 className="text-[1.9rem] leading-[1.7] font-black sm:text-[2.4rem]">
        <BidiText text={g.title} />
      </h1>
      <p className="mt-3 text-sm text-muted">
        آخرین به‌روزرسانی:{" "}
        <time dateTime={g.updated}>
          {formatFaDate(g.updated)} ({formatGregorianFa(g.updated)})
        </time>
      </p>

      <section className="mt-6 rounded-xl border-s-4 border-brand bg-brand-soft p-5" aria-labelledby="summary">
        <h2 id="summary" className="mb-2 text-lg font-black">خلاصه در یک نگاه</h2>
        <ArticleBody body={g.summary.map((s) => `- ${s}`).join("\n")} />
      </section>

      <nav className="mt-6 rounded-xl border border-line bg-surface p-5" aria-labelledby="toc">
        <h2 id="toc" className="mb-2 font-black">فهرست مطالب</h2>
        <ol className="list-inside space-y-1.5 leading-8 [list-style-type:persian]">
          {toc(g.body).map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-brand hover:underline">
                <BidiText text={t.text} />
              </a>
            </li>
          ))}
          <li>
            <a href="#faq" className="text-brand hover:underline">پرسش‌های رایج</a>
          </li>
        </ol>
      </nav>

      <div className="mt-6">
        <ArticleBody body={g.body} />
      </div>

      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="mb-4 scroll-mt-36 text-2xl font-black">{g.faqTitle ?? "پرسش‌های رایج"}</h2>
        <div className="space-y-3">
          {g.faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border border-line bg-surface p-4 open:border-brand">
              <summary className="cursor-pointer list-none font-bold leading-8">
                <span className="me-2 text-brand group-open:hidden">+</span>
                <span className="me-2 hidden text-brand group-open:inline">−</span>
                <BidiText text={f.q} />
              </summary>
              <p className="mt-2 leading-8 text-muted">
                <BidiText text={plain(f.a)} />
              </p>
            </details>
          ))}
        </div>
      </section>

      <footer className="mt-10 space-y-4 rounded-xl border border-line bg-surface p-5 text-sm leading-7">
        <div>
          <p className="mb-2 font-bold">منابع رسمی:</p>
          <ul className="list-disc space-y-1 ps-5">
            {g.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener" className="text-brand hover:underline">
                  <bdi dir="ltr">{s.name}</bdi>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-muted">
          این راهنما برای اطلاع‌رسانی عمومی است و مشاوره حقوقی به حساب نمی‌آید. قوانین مهاجرت ممکن است تغییر کند؛ پیش از
          هر اقدام، اطلاعات را با سایت رسمی اداره مهاجرت ایرلند مطابقت دهید یا با مشاور مهاجرت معتبر مشورت کنید.
        </p>
        <ShareButtons url={url} title={g.title} />
      </footer>

      {GUIDES.length > 1 && (
        <section className="mt-10" aria-labelledby="more-guides">
          <h2 id="more-guides" className="mb-4 text-xl font-black">راهنماهای دیگر</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {GUIDES.filter((o) => o.slug !== g.slug).map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/guides/${o.slug}`}
                  className="block h-full rounded-xl border border-line bg-surface p-4 leading-8 font-bold transition hover:border-brand"
                >
                  <BidiText text={o.title} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
