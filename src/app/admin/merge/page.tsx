import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { relativeFa } from "@/lib/dates";
import { mergeArticles } from "../actions";
import { StatusBadge } from "@/components/admin/ui";

export default function MergePage({ searchParams }: PageProps<"/admin/merge">) {
  return (
    <Suspense fallback={<p className="text-muted">در حال بارگذاری…</p>}>
      <Merge searchParams={searchParams} />
    </Suspense>
  );
}

async function Merge({ searchParams }: { searchParams: PageProps<"/admin/merge">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const ids = (Array.isArray(sp.ids) ? sp.ids : sp.ids ? [sp.ids] : []).slice(0, 10);
  const { data: rows } = ids.length
    ? await adminDb().from("articles").select("id, title_fa, summary_fa, status, source_name, image_url, created_at").in("id", ids)
    : { data: [] };

  if (!rows || rows.length < 2) {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-surface p-6">
        <p>برای ادغام دست‌کم دو خبر را در فهرست تیک بزن.</p>
        <Link href="/admin" className="text-brand">
          → برگشت به فهرست
        </Link>
      </div>
    );
  }

  return (
    <form action={mergeArticles} className="space-y-4">
      <h1 className="text-xl font-black">ادغام خبرها</h1>
      <p className="leading-8 text-muted">
        خبر اصلی را انتخاب کن. تیتر و خلاصه‌ی آن می‌ماند، متن بقیه زیر آن اضافه می‌شود و خبرهای دیگر پنهان می‌شوند (پاک نمی‌شوند). بعد از ادغام، صفحه ویرایش باز
        می‌شود تا تکرارها را پاک کنی.
      </p>
      {rows.map((a, i) => (
        <label key={a.id} className="flex cursor-pointer gap-3 rounded-xl border border-line bg-surface p-4 has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
          <input type="radio" name="main" value={a.id} defaultChecked={i === 0} className="mt-1.5 size-4" />
          <input type="hidden" name="ids" value={a.id} />
          <div className="space-y-1">
            <div className="font-bold leading-7">{a.title_fa}</div>
            <p className="line-clamp-2 text-sm leading-7 text-muted">{a.summary_fa}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              <StatusBadge status={a.status} />
              <span>{a.source_name}</span>
              <span>{relativeFa(a.created_at)}</span>
              {a.image_url && <span>عکس دارد</span>}
            </div>
          </div>
        </label>
      ))}
      <button className="rounded-lg bg-brand px-8 py-3 font-bold text-white">ادغام کن</button>
    </form>
  );
}
