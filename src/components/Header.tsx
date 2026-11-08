import Link from "next/link";
import { Logo } from "./Logo";
import { NAV_CATEGORIES, getCategory } from "@/lib/categories";
import { formatFaDate } from "@/lib/dates";
import { cacheLife } from "next/cache";

export async function Header() {
  "use cache";
  cacheLife("hours");
  const today = formatFaDate(new Date().toISOString());
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div aria-hidden dir="ltr" className="flex h-1">
        <span className="flex-1 bg-[#169b62]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#ff883e]" />
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="صفحه اصلی">
          <Logo />
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="hidden sm:inline">{today}</span>
          <Link
            href="/search"
            className="rounded-full border border-line px-3 py-1.5 transition hover:border-brand hover:text-brand"
          >
            جستجو
          </Link>
        </div>
      </div>
      <nav className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 text-[15px]">
        {NAV_CATEGORIES.map((slug) => (
          <Link
            key={slug}
            href={`/category/${slug}`}
            className="shrink-0 rounded-full px-3 py-1.5 font-medium text-muted transition hover:bg-brand-soft hover:text-brand"
          >
            {getCategory(slug)?.name}
          </Link>
        ))}
        <Link
          href="/guides"
          className="shrink-0 rounded-full px-3 py-1.5 font-bold text-brand transition hover:bg-brand-soft"
        >
          راهنماها
        </Link>
      </nav>
    </header>
  );
}
