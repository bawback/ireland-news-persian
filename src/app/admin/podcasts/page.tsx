import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { formatDayFa } from "@/lib/dates";
import { minutes, PODCAST } from "@/lib/podcasts";
import { Notice } from "@/components/admin/ui";

export default function AdminPodcasts({ searchParams }: PageProps<"/admin/podcasts">) {
  return (
    <Suspense fallback={<p className="text-muted">در حال بارگذاری…</p>}>
      <List searchParams={searchParams} />
    </Suspense>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/admin/podcasts">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const { data: rows, error } = await adminDb()
    .from("podcasts")
    .select("id, episode_date, title, duration_sec, telegram_message_id")
    .order("episode_date", { ascending: false })
    .limit(100);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-black">🎙 قسمت‌های «{PODCAST.name}»</h1>
      {sp.deleted && <Notice>قسمت حذف شد.</Notice>}
      {error && <Notice error>خواندن قسمت‌ها ممکن نشد: {error.message}</Notice>}
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {(rows ?? []).map((e) => (
          <li key={e.id} className="space-y-1 p-3 sm:p-4">
            <Link href={`/admin/podcasts/edit?id=${e.id}`} className="block leading-7 font-bold hover:text-brand">
              {formatDayFa(e.episode_date)} · {e.title}
            </Link>
            <p className="text-xs text-muted">
              {minutes(e.duration_sec)} · {e.telegram_message_id ? "در تلگرام منتشر شده" : "در تلگرام منتشر نشده"}
            </p>
          </li>
        ))}
        {!rows?.length && <li className="p-6 text-center text-muted">هنوز قسمتی ساخته نشده است.</li>}
      </ul>
    </div>
  );
}
