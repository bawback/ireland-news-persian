import { SITE } from "@/lib/site";

/** Invites readers (mostly arriving from Google) to join the Telegram channel. */
export function TelegramCta() {
  return (
    <aside className="mt-10 flex flex-col items-start gap-4 rounded-2xl border border-brand/30 bg-brand-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <p className="text-lg leading-8 font-black">📲 خبرهای مهم ایرلند را هر روز در تلگرام بخوانید</p>
        <p className="mt-1 leading-7 text-muted">هر صبح ساعت ۸ خلاصه ۵ خبر مهم، به‌اضافه خبرهای فوری و راهنماهای کاربردی.</p>
      </div>
      <a
        href={SITE.telegram}
        target="_blank"
        rel="noopener"
        className="shrink-0 rounded-full bg-brand px-5 py-2.5 font-bold text-white transition hover:opacity-90"
      >
        عضویت در کانال
      </a>
    </aside>
  );
}
