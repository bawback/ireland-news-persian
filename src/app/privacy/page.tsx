import type { Metadata } from "next";

export const metadata: Metadata = { title: "حریم خصوصی", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <div className="prose-fa mx-auto max-w-3xl">
      <h1 className="mb-6 text-3xl font-black">سیاست حریم خصوصی</h1>
      <p>
        این صفحه پیش‌نویس است و پیش از فعال شدن تبلیغات و ابزارهای آمار بازدید، با متن کامل و مطابق مقررات GDPR جایگزین می‌شود.
      </p>
      <h2>اطلاعاتی که جمع می‌کنیم</h2>
      <p>در حال حاضر هیچ اطلاعات شخصی از بازدیدکنندگان جمع‌آوری نمی‌شود و از کوکی تبلیغاتی استفاده نمی‌کنیم.</p>
    </div>
  );
}
