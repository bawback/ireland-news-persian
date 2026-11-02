import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { categoryName } from "@/lib/categories";
import { relativeFa } from "@/lib/dates";
import { setStatus } from "./actions";
import { Notice, StatusBadge } from "@/components/admin/ui";

const PAGE_SIZE = 40;

export default function AdminHome({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-muted">در حال بارگذاری…</p>}>
      <ArticleList searchParams={searchParams} />
    </Suspense>
  );
}

const FILTERS = [
  { value: "", label: "همه" },
  { value: "published", label: "منتشرشده" },
  { value: "pending_review", label: "در انتظار" },
  { value: "rejected", label: "پنهان" },
];

async function ArticleList({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  let query = adminDb()
    .from("articles")
    .select("id, slug, title_fa, category, status, source_name, image_url, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("title_fa", `%${q.replace(/[%_,()]/g, " ")}%`);
  const { data: rows, count, error } = await query;

  const link = (p: Record<string, string | number>) => {
    const params = new URLSearchParams({ ...(status && { status }), ...(q && { q }), ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) });
    for (const [k, v] of [...params]) if (!v) params.delete(k);
    return `/admin?${params}`;
  };

  return (
    <div className="space-y-4">
      {sp.deleted && <Notice>خبر حذف شد.</Notice>}
      {sp.error === "merge" && <Notice error>ادغام انجام نشد. دست‌کم دو خبر را انتخاب کن.</Notice>}
      {error && <Notice error>خواندن خبرها ممکن نشد: {error.message}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={link({ status: f.value, page: "" })}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${status === f.value ? "bg-brand text-white" : "bg-surface border border-line"}`}
          >
            {f.label}
          </Link>
        ))}
        <form className="ms-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="جستجو در تیترها" className="w-44 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm" />
          <button className="rounded-lg border border-line px-3 text-sm">جستجو</button>
        </form>
      </div>

      <form id="merge-form" action="/admin/merge" className="flex flex-wrap items-center gap-3 rounded-lg bg-brand-soft px-4 py-2 text-sm">
        <span>برای ادغام، دو یا چند خبر درباره یک ماجرا را تیک بزن و بعد:</span>
        <button className="rounded-lg bg-brand px-3 py-1 font-bold text-white">ادغام خبرهای انتخاب‌شده</button>
      </form>

      <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
        {(rows ?? []).map((a) => (
          <li key={a.id} className="flex items-start gap-3 p-3 sm:p-4">
            <input type="checkbox" name="ids" value={a.id} form="merge-form" aria-label="انتخاب برای ادغام" className="mt-1.5 size-4" />
            {a.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image_url} alt="" className="size-14 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="grid size-14 shrink-0 place-items-center rounded-md bg-line text-xs text-muted">بدون عکس</div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <Link href={`/admin/edit?id=${a.id}`} className="block leading-7 font-bold hover:text-brand">
                {a.title_fa}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                <StatusBadge status={a.status} />
                <span>{categoryName(a.category)}</span>
                <span>{a.source_name}</span>
                <span>{relativeFa(a.created_at)}</span>
                {a.status === "published" && (
                  <Link href={`/news/${a.slug}`} target="_blank" className="text-brand hover:underline">
                    دیدن در سایت
                  </Link>
                )}
              </div>
            </div>
            <form action={setStatus} className="shrink-0">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="status" value={a.status === "published" ? "rejected" : "published"} />
              <button className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:border-brand">
                {a.status === "published" ? "پنهان کن" : "منتشر کن"}
              </button>
            </form>
          </li>
        ))}
        {!rows?.length && <li className="p-6 text-center text-muted">خبری پیدا نشد.</li>}
      </ul>

      <div className="flex justify-between text-sm">
        {page > 1 ? <Link href={link({ page: page - 1 })}>→ صفحه قبل</Link> : <span />}
        {(count ?? 0) > page * PAGE_SIZE && <Link href={link({ page: page + 1 })}>صفحه بعد ←</Link>}
      </div>
    </div>
  );
}
