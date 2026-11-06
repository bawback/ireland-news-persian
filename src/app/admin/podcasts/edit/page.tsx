import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { formatDayFa } from "@/lib/dates";
import { minutes } from "@/lib/podcasts";
import { SITE } from "@/lib/site";
import { deletePodcast, savePodcast } from "../../actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Notice } from "@/components/admin/ui";

export default function EditPodcastPage({ searchParams }: PageProps<"/admin/podcasts/edit">) {
  return (
    <Suspense fallback={<p className="text-muted">در حال بارگذاری…</p>}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

const ERRORS: Record<string, string> = {
  empty: "عنوان نباید خالی باشد.",
  save: "ذخیره انجام نشد. دوباره امتحان کن.",
  delete: "حذف انجام نشد.",
};

const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 leading-8";

async function Editor({ searchParams }: { searchParams: PageProps<"/admin/podcasts/edit">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: e } = await adminDb().from("podcasts").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/podcasts" className="text-brand">→ همه قسمت‌ها</Link>
        <span className="font-semibold">{formatDayFa(e.episode_date)}</span>
        <span className="text-muted">{minutes(e.duration_sec)}</span>
        {e.telegram_message_id && (
          <a href={`${SITE.telegram}/${e.telegram_message_id}`} target="_blank" className="text-brand hover:underline">دیدن در تلگرام</a>
        )}
      </div>

      {sp.saved && <Notice>ذخیره شد و روی سایت به‌روز شد.</Notice>}
      {typeof sp.error === "string" && ERRORS[sp.error] && <Notice error>{ERRORS[sp.error]}</Notice>}

      <audio controls preload="metadata" src={e.audio_url} className="w-full" />

      <form action={savePodcast} className="space-y-5 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <input type="hidden" name="id" value={e.id} />
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">عنوان</span>
          <input name="title" defaultValue={e.title} className={field} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">توضیح کوتاه</span>
          <textarea name="description" defaultValue={e.description} rows={3} className={field} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">متن کامل</span>
          <textarea name="script" defaultValue={e.script} rows={18} className={field} />
          <span className="block text-xs text-muted">تغییر متن فقط نوشته روی سایت را عوض می‌کند، نه صدای ضبط‌شده را.</span>
        </label>
        <button className="rounded-lg bg-brand px-5 py-2 font-bold text-white">ذخیره</button>
      </form>

      <form action={deletePodcast} className="rounded-xl border border-accent/40 p-4">
        <input type="hidden" name="id" value={e.id} />
        <ConfirmButton message="این قسمت و فایل صوتی‌اش برای همیشه پاک شود؟" className="font-bold text-accent">
          حذف همیشگی این قسمت
        </ConfirmButton>
        <p className="mt-1 text-xs text-muted">از سایت و فید پادکست پاک می‌شود. پستی که در تلگرام رفته را باید در خود تلگرام پاک کنی.</p>
      </form>
    </div>
  );
}
