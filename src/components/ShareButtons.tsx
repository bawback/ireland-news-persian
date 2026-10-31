export function ShareButtons({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "تلگرام", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { name: "واتس‌اپ", href: `https://wa.me/?text=${t}%0A${u}` },
    { name: "ایکس", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { name: "فیس‌بوک", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">اشتراک‌گذاری:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener"
          className="rounded-full border border-line px-3 py-1 text-sm transition hover:border-brand hover:text-brand"
        >
          {l.name}
        </a>
      ))}
    </div>
  );
}
