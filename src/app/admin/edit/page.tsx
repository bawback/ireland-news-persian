import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/auth";
import { adminDb } from "@/lib/admin/db";
import { CATEGORIES } from "@/lib/categories";
import { formatFaDateTime } from "@/lib/dates";
import { deleteArticle, saveArticle } from "../actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Notice, StatusBadge } from "@/components/admin/ui";

export default function EditPage({ searchParams }: PageProps<"/admin/edit">) {
  return (
    <Suspense fallback={<p className="text-muted">در حال بارگذاری…</p>}>
      <Editor searchParams={searchParams} />
    </Suspense>
  );
}

const ERRORS: Record<string, string> = {
  empty: "تیتر و متن خبر نباید خالی باشند.",
  image: "آپلود عکس انجام نشد. یک عکس دیگر امتحان کن.",
  save: "ذخیره انجام نشد. دوباره امتحان کن.",
  delete: "حذف انجام نشد.",
};

const field = "w-full rounded-lg border border-line bg-bg px-3 py-2 leading-8";

async function Editor({ searchParams }: { searchParams: PageProps<"/admin/edit">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: a } = await adminDb().from("articles").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin" className="text-brand">
          → همه خبرها
        </Link>
        <StatusBadge status={a.status} />
        <span className="text-muted">ساخته‌شده: {formatFaDateTime(a.created_at)}</span>
        {a.status === "published" && (
          <Link href={`/news/${a.slug}`} target="_blank" className="text-brand hover:underline">
            دیدن در سایت
          </Link>
        )}
      </div>

      {sp.saved && <Notice>ذخیره شد و روی سایت به‌روز شد.</Notice>}
      {sp.merged && <Notice>{`${sp.merged} خبر دیگر در این خبر ادغام و پنهان شد. متن را مرور کن و تکرارها را پاک کن.`}</Notice>}
      {typeof sp.error === "string" && ERRORS[sp.error] && <Notice error>{ERRORS[sp.error]}</Notice>}

      <form action={saveArticle} className="space-y-5 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <input type="hidden" name="id" value={a.id} />

        <Label text="تیتر">
          <input name="title_fa" defaultValue={a.title_fa} required className={`${field} text-lg font-bold`} />
        </Label>

        <Label text="خلاصه (لید)">
          <textarea name="summary_fa" defaultValue={a.summary_fa} rows={3} className={field} />
        </Label>

        <Label text="متن خبر" hint="بین پاراگراف‌ها یک خط خالی بگذار. «## » اول خط = تیتر میانی، «- » = فهرست، «> » = نقل‌قول.">
          <textarea name="body_fa" defaultValue={a.body_fa} rows={18} required className={field} />
        </Label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="وضعیت">
            <select name="status" defaultValue={a.status} className={field}>
              <option value="published">منتشرشده (روی سایت)</option>
              <option value="pending_review">در انتظار</option>
              <option value="rejected">پنهان</option>
            </select>
          </Label>
          <Label text="دسته">
            <select name="category" defaultValue={a.category} className={field}>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Label>
          <Label text="اهمیت خبر (۱ تا ۵)">
            <input type="number" name="importance" min={1} max={5} defaultValue={a.importance} className={field} />
          </Label>
          <Label text="اهمیت برای مهاجران (۰ تا ۳)" hint="۲ یا بیشتر = برچسب «مهم برای مهاجران»">
            <input type="number" name="immigrant_relevance" min={0} max={3} defaultValue={a.immigrant_relevance} className={field} />
          </Label>
        </div>

        <Label text="برچسب‌ها" hint="با ویرگول جدا کن">
          <input name="tags" defaultValue={(a.tags ?? []).join("، ")} className={field} />
        </Label>

        <fieldset className="space-y-3 rounded-lg border border-line p-4">
          <legend className="px-2 font-bold">عکس خبر</legend>
          <ImagePicker current={a.image_url} />
          <Label text="یا لینک یک عکس" hint="اگر عکس آپلود کنی، این لینک خودکار عوض می‌شود.">
            <input name="image_url" defaultValue={a.image_url ?? ""} dir="ltr" className={field} />
          </Label>
          <Label text="منبع عکس" hint="مثلاً: عکس از رویترز. فقط از عکس‌هایی استفاده کن که حق استفاده‌اش را داری.">
            <input name="image_credit" defaultValue={a.image_credit ?? ""} className={field} />
          </Label>
          <Label text="توضیح عکس (alt)" hint="یک جمله کوتاه که بگوید در عکس چه دیده می‌شود. برای گوگل و نابینایان مهم است.">
            <input name="image_alt" defaultValue={a.image_alt ?? ""} className={field} />
          </Label>
          {a.image_url && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_image" className="size-4" /> حذف عکس
            </label>
          )}
        </fieldset>

        <p className="text-sm text-muted">
          منبع: {a.source_name}{" "}
          {a.source_url && (
            <a href={a.source_url} target="_blank" rel="noopener" className="text-brand" dir="ltr">
              (لینک خبر اصلی)
            </a>
          )}
        </p>

        <button className="w-full rounded-lg bg-brand py-3 font-bold text-white sm:w-auto sm:px-10">ذخیره</button>
      </form>

      <form action={deleteArticle} className="rounded-xl border border-accent/40 p-4">
        <input type="hidden" name="id" value={a.id} />
        <ConfirmButton message="این خبر برای همیشه پاک شود؟" className="font-bold text-accent">
          حذف همیشگی این خبر
        </ConfirmButton>
        <p className="mt-1 text-xs text-muted">اگر فقط نمی‌خواهی روی سایت باشد، وضعیت را «پنهان» کن تا بعداً بشود برش گرداند.</p>
      </form>
    </div>
  );
}

function Label({ text, hint, children }: { text: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{text}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}
