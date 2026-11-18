import Link from "next/link";

/** Previous / next links for archive pages. `base` is page 1; page n lives at `${base}/page/${n}`. */
export function Pagination({ base, page, hasNext }: { base: string; page: number; hasNext: boolean }) {
  if (page <= 1 && !hasNext) return null;
  const href = (n: number) => (n <= 1 ? base : `${base}/page/${n}`);
  const fa = (n: number) => n.toLocaleString("fa-IR");
  return (
    <nav aria-label="صفحه‌بندی" className="mt-10 flex items-center justify-between gap-4 text-sm font-bold">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className="rounded-full border border-line px-5 py-2 hover:border-brand hover:text-brand">
          → خبرهای جدیدتر
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">صفحه {fa(page)}</span>
      {hasNext ? (
        <Link href={href(page + 1)} rel="next" className="rounded-full border border-line px-5 py-2 hover:border-brand hover:text-brand">
          خبرهای قدیمی‌تر ←
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
