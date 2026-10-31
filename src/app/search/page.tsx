import type { Metadata } from "next";
import { Suspense } from "react";
import { searchArticles } from "@/lib/articles";
import { ArticleCard } from "@/components/ArticleCard";

export const metadata: Metadata = { title: "جستجو" };

function SearchForm({ term = "" }: { term?: string }) {
  return (
    <form action="/search" className="mb-8 flex gap-2">
      <input
        name="q"
        defaultValue={term}
        placeholder="مثلاً: اقامت، اجاره، مالیات…"
        className="flex-1 rounded-full border border-line bg-surface px-5 py-3 outline-none focus:border-brand"
      />
      <button className="rounded-full bg-brand px-6 py-3 font-bold text-white hover:opacity-90">جستجو</button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const term = typeof q === "string" ? q : "";
  const results = term ? await searchArticles(term) : [];
  return (
    <>
      <SearchForm term={term} />
      {term && results.length === 0 && <p className="text-muted">نتیجه‌ای برای «{term}» پیدا نشد.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((a) => (
          <ArticleCard key={a.id} a={a} />
        ))}
      </div>
    </>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-black">جستجو در خبرها</h1>
      <Suspense fallback={<SearchForm />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
