import Link from "next/link";
import { JsonLd } from "./JsonLd";
import { SITE } from "@/lib/site";

export type Crumb = { name: string; href: string };

/** Visible breadcrumb trail plus the matching BreadcrumbList structured data. "خانه" is added first. */
export function Breadcrumbs({ items, className = "mb-4" }: { items: Crumb[]; className?: string }) {
  const all: Crumb[] = [{ name: "خانه", href: "/" }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.href === "/" ? SITE.url : `${SITE.url}${c.href}`,
    })),
  };
  // The last crumb is the current page; it is shown only in the structured data.
  const visible = all.slice(0, -1).length ? all.slice(0, -1) : all;
  return (
    <>
      <JsonLd data={ld} />
      <nav aria-label="مسیر صفحه" className={`text-sm text-muted ${className}`}>
        <ol className="flex flex-wrap items-center gap-x-2">
          {visible.map((c, i) => (
            <li key={c.href} className="flex items-center gap-x-2">
              {i > 0 && <span aria-hidden>/</span>}
              <Link href={c.href} className="hover:text-brand">
                {c.name}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
