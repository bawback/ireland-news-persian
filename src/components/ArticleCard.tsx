import Link from "next/link";
import { isHot, type Article } from "@/lib/types";
import { categoryName } from "@/lib/categories";
import { isNorthernIreland, NI_BADGE } from "@/lib/region";
import { relativeFa } from "@/lib/dates";
import { BidiText } from "./BidiText";

function Cover({ a, className, priority = false }: { a: Article; className: string; priority?: boolean }) {
  if (!a.image_url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={a.image_url}
      alt={a.image_alt || a.title_fa}
      width={1200}
      height={675}
      // The lead picture is usually the largest thing on the home page (LCP), so it loads first.
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      className={`h-auto w-full max-w-full object-cover ${className}`}
    />
  );
}

/** «📍 ایرلند شمالی»: shown on every Northern Ireland story, whatever its category. */
export function NiBadge({ className = "px-2 py-0.5" }: { className?: string }) {
  return <span className={`rounded-full bg-ni-soft font-semibold text-ni ${className}`}>{NI_BADGE}</span>;
}

function Meta({ a }: { a: Article }) {
  const ni = isNorthernIreland(a);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {/* A story in the Northern Ireland category needs no second chip with the same name. */}
      {ni && a.category === "northern-ireland" ? (
        <NiBadge />
      ) : (
        <>
          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand">{categoryName(a.category)}</span>
          {ni && <NiBadge />}
        </>
      )}
      {isHot(a) && <span className="rounded-full bg-hot-soft px-2 py-0.5 font-semibold text-hot">🔥 خبر داغ</span>}
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
      <Cover a={a} priority className="mb-5 block aspect-[16/9] rounded-xl" />
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
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:shadow-md"
    >
      <Cover a={a} className="block aspect-[16/9] shrink-0" />
      <div className="flex flex-1 flex-col p-5">
        <Meta a={a} />
        <h3 className="mt-3 text-lg leading-8 font-bold group-hover:text-brand">
          <BidiText text={a.title_fa} />
        </h3>
        <p className="mt-2 line-clamp-3 text-[15px] leading-7 text-muted">
          <BidiText text={a.summary_fa} />
        </p>
      </div>
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
        {isNorthernIreland(a) && (
          <>
            <span className="font-semibold text-ni">{NI_BADGE}</span> ·{" "}
          </>
        )}
        {a.category !== "northern-ireland" && <>{categoryName(a.category)} · </>}
        <time dateTime={a.published_at}>{relativeFa(a.published_at)}</time>
      </div>
    </Link>
  );
}
