import Link from "next/link";
import { Logo } from "./Logo";
import { CATEGORIES } from "@/lib/categories";
import { SITE } from "@/lib/site";

export function Footer() {
  const socials = [
    { name: "تلگرام", href: SITE.telegram },
    { name: "اینستاگرام", href: SITE.instagram },
    { name: "ایکس", href: SITE.x },
  ].filter((s) => s.href);

  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm leading-7 text-muted">{SITE.description}</p>
          {socials.length > 0 && (
            <div className="flex gap-3 text-sm">
              {socials.map((s) => (
                <a key={s.name} href={s.href} className="text-brand hover:underline" target="_blank" rel="noopener">
                  {s.name}
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-3 font-bold">دسته‌ها</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className="hover:text-brand">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 font-bold">درباره ما</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/podcast" className="hover:text-brand">پادکست شبانه</Link></li>
            <li><Link href="/guides" className="hover:text-brand">راهنماهای زندگی در ایرلند</Link></li>
            <li><Link href="/about" className="hover:text-brand">درباره و شیوه کار ما</Link></li>
            <li><Link href="/advertise" className="hover:text-brand">تبلیغ در اخبار ایرلند</Link></li>
            <li><Link href="/privacy" className="hover:text-brand">حریم خصوصی</Link></li>
            <li><a href="/feed.xml" className="hover:text-brand">خوراک RSS</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        خبرها از منابع معتبر ایرلندی گرفته شده و منبع هر خبر زیر آن ذکر شده است. ترجمه و تنظیم با کمک هوش مصنوعی و بازبینی انسانی.
      </div>
    </footer>
  );
}
