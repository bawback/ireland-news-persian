import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { getByCategory } from "@/lib/articles";
import { ArticleCard } from "@/components/ArticleCard";
import { cacheLife } from "next/cache";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  return cat ? { title: cat.name, description: cat.description } : {};
}

export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-line" />}>
      <CategoryLoader params={params} />
    </Suspense>
  );
}

async function CategoryLoader({ params }: { params: PageProps<"/category/[slug]">["params"] }) {
  const { slug } = await params;
  return <CategoryView slug={slug} />;
}

async function CategoryView({ slug }: { slug: string }) {
  "use cache";
  cacheLife("minutes");
  const cat = getCategory(slug);
  if (!cat) notFound();
  const articles = await getByCategory(slug, 60);

  return (
    <div>
      <header className="mb-8 border-b border-line pb-6">
        <h1 className="text-3xl font-black">{cat.name}</h1>
        <p className="mt-2 text-muted">{cat.description}</p>
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
    </div>
  );
}
