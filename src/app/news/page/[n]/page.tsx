import type { Metadata } from "next";
import { Suspense } from "react";
import { ArchiveView, archiveMetadata, pageNumber } from "@/components/ArchiveView";

export function generateStaticParams() {
  // Cache Components needs at least one entry at build time; other pages render on first visit.
  return [{ n: "2" }];
}

export async function generateMetadata({ params }: PageProps<"/news/page/[n]">): Promise<Metadata> {
  const { n } = await params;
  return archiveMetadata(pageNumber(n));
}

export default function NewsArchivePage({ params }: PageProps<"/news/page/[n]">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-line" />}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: PageProps<"/news/page/[n]">["params"] }) {
  const { n } = await params;
  return <ArchiveView page={pageNumber(n)} />;
}
