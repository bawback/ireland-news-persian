import type { Metadata } from "next";
import { Suspense } from "react";
import { ArchiveView, archiveMetadata, pageNumber } from "@/components/ArchiveView";

export function generateStaticParams() {
  // Cache Components needs at least one entry at build time; other pages render on first visit.
  return [{ slug: "ireland", n: "2" }];
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]/page/[n]">): Promise<Metadata> {
  const { slug, n } = await params;
  return archiveMetadata(pageNumber(n), slug);
}

export default function CategoryArchivePage({ params }: PageProps<"/category/[slug]/page/[n]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-line" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: PageProps<"/category/[slug]/page/[n]">["params"] }) {
  const { slug, n } = await params;
  return <ArchiveView page={pageNumber(n)} category={slug} />;
}
