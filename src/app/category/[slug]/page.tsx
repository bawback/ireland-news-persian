import type { Metadata } from "next";
import { Suspense } from "react";
import { CATEGORIES } from "@/lib/categories";
import { ArchiveView, archiveMetadata } from "@/components/ArchiveView";

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return archiveMetadata(1, slug);
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
  return <ArchiveView page={1} category={slug} />;
}
