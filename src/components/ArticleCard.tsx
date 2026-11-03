import Link from "next/link";
import type { Article } from "@/lib/types";
import { categoryName } from "@/lib/categories";
import { relativeFa } from "@/lib/dates";
import { BidiText } from "./BidiText";

function Cover({ a, className }: { a: Article; className: string }) {
  if (!a.image_url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={a.image_url}
      alt={a.image_alt ?? ""}
      width={1200}
      height={675}
      loading="lazy"
      decoding="async"
      className={`w-full object-cover ${className}`}
    />
  );
}

function Meta({ a }: { a: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">{categoryName(a.category)}</span>
      {a.immigrant_relevance >= 2 && (
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">مهم برای مهاجران</span>
      )}
      <time dateTime={a.published_at}>{relativeFa(a.published_at)}</time>
    </div>
  );
}

export function LeadCard({ a }: { a: Article }) {
  return (
    <Link
      href={`/news/${a.slug}`}
      className="group block rounded-2xl border border-line bg-surface p-6 shadow-sm transition hover:shadow-md sm:p-8"
    >
      <Cover a={a} className="mb-5 aspect-[16/9] rounded-xl" />
      <Meta a={a} />
      <h2 className="mt-4 text-2xl leading-[1.6] font-black group-hover:text-brand sm:text-[2rem]">
        <BidiText text={a.title_fa} />
      </h2>
      <p className="mt-4 text-lg leading-9 text-muted">
        <BidiText text={a.summary_fa} />
      </p>
      <span className="mt-6 inline-block text-sm font-bold text-brand">ادامه خبر ←</span>
    </Link>
  );
}

export function ArticleCard({ a }: { a: Article }) {
  return (
    <Link
      href={`/news/${a.slug}`}
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <Cover a={a} className="-mx-5 -mt-5 mb-4 aspect-[16/9] w-[calc(100%+2.5rem)] max-w-none rounded-t-xl" />
      <Meta a={a} />
      <h3 className="mt-3 text-lg leading-8 font-bold group-hover:text-brand">
        <BidiText text={a.title_fa} />
      </h3>
      <p className="mt-2 line-clamp-3 text-[15px] leading-7 text-muted">
        <BidiText text={a.summary_fa} />
      </p>
    </Link>
  );
}

export function CompactItem({ a }: { a: Article }) {
  return (
    <Link href={`/news/${a.slug}`} className="group block border-b border-line py-3 last:border-0">
      <h4 className="leading-7 font-semibold group-hover:text-brand">
        <BidiText text={a.title_fa} />
      </h4>
      <div className="mt-1 text-xs text-muted">
        {categoryName(a.category)} · <time dateTime={a.published_at}>{relativeFa(a.published_at)}</time>
      </div>
    </Link>
  );
}
