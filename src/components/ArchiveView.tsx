import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { getArchivePage } from "@/lib/articles";
import { getCategory } from "@/lib/categories";
import { SITE } from "@/lib/site";
import { ArticleCard } from "./ArticleCard";
import { Breadcrumbs } from "./Breadcrumbs";
import { JsonLd } from "./JsonLd";
import { Pagination } from "./Pagination";

export const PER_PAGE = 30;

/** Page number from a "/page/[n]" segment; anything but a whole number above 1 is a 404. */
export function pageNumber(n: string): number {
  if (!/^[0-9]+$/.test(n)) notFound();
  const page = Number(n);
  if (page < 2 || page > 1000) notFound();
  return page;
}

function info(category?: string) {
  if (!category) {
    return {
      base: "/news",
      heading: "همه اخبار ایرلند",
      description:
        "آرشیو کامل اخبار ایرلند به فارسی: همه خبرهای ایرلند و ایرلند شمالی، از تازه‌ترین تا قدیمی‌تر، از منابع معتبر ایرلندی.",
      crumbs: [{ name: "همه اخبار ایرلند", href: "/news" }],
    };
  }
  const cat = getCategory(category);
  if (!cat) notFound();
  return {
    base: `/category/${cat.slug}`,
    heading: cat.heading,
    description: cat.seoDescription,
    crumbs: [{ name: cat.heading, href: `/category/${cat.slug}` }],
  };
}

export function archiveMetadata(page: number, category?: string): Metadata {
  const cat = category ? getCategory(category) : undefined;
  if (category && !cat) notFound();
  const { base, heading, description } = info(category);
  const suffix = page > 1 ? ` (صفحه ${page.toLocaleString("fa-IR")})` : "";
  const url = page > 1 ? `${base}/page/${page}` : base;
  const title = `${heading}${suffix}`;
  return {
    title,
    description: page > 1 ? `${description}${suffix}` : description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: `${title} | ${SITE.name}`, description, url, images: ["/opengraph-image.png"] },
  };
}

export async function ArchiveView({ page, category }: { page: number; category?: string }) {
  "use cache";
  cacheLife("minutes");
  const { base, heading, description, crumbs } = info(category);
  const { articles, hasNext } = await getArchivePage(page, PER_PAGE, category);
  if (page > 1 && articles.length === 0) notFound();
  const url = `${SITE.url}${page > 1 ? `${base}/page/${page}` : base}`;

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: heading,
    description,
    url,
    inLanguage: "fa",
    isPartOf: { "@id": `${SITE.url}/#website` },
    about: { "@type": "Country", name: "Ireland" },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: (page - 1) * PER_PAGE + i + 1,
        url: `${SITE.url}/news/${a.slug}`,
        name: a.title_fa,
      })),
    },
  };

  return (
    <div>
      <JsonLd data={collection} />
      <Breadcrumbs
        items={page > 1 ? [...crumbs, { name: `صفحه ${page.toLocaleString("fa-IR")}`, href: `${base}/page/${page}` }] : crumbs}
      />
      <header className="mb-8 border-b border-line pb-6">
        <h1 className="text-3xl leading-[1.6] font-black">
          {heading}
          {page > 1 && <span className="text-muted"> - صفحه {page.toLocaleString("fa-IR")}</span>}
        </h1>
        <p className="mt-2 leading-8 text-muted">{description}</p>
      </header>
      {articles.length === 0 ? (
        <p className="py-16 text-center text-muted">هنوز خبری در این دسته منتشر نشده است.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
      <Pagination base={base} page={page} hasNext={hasNext} />
    </div>
  );
}
