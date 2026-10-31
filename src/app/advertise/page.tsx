import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "تبلیغ در اخبار ایرلند به فارسی" };

const packages = [
  { name: "معرفی در شبکه‌های اجتماعی", items: ["یک پست اختصاصی در تلگرام و اینستاگرام", "لینک به وب‌سایت یا صفحه شما"] },
  { name: "بنر در وب‌سایت", items: ["نمایش بنر در صفحه اصلی و صفحه خبرها", "گزارش ماهانه تعداد نمایش و کلیک"] },
  { name: "بسته ویژه ماهانه", items: ["بنر وب‌سایت + چهار پست در ماه", "نمایش ویژه در راهنمای کسب‌وکارهای ایرانی"] },
];

export default function AdvertisePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-black">کسب‌وکار خود را به جامعه فارسی‌زبان ایرلند معرفی کنید</h1>
      <p className="mt-4 text-lg leading-9 text-muted">
        مخاطبان ما فارسی‌زبانان مقیم ایرلند و ایرلند شمالی هستند: همان مشتریانی که به دنبال خدمات شما می‌گردند.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {packages.map((p) => (
          <div key={p.name} className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="text-lg font-black">{p.name}</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-[15px] leading-7 text-muted">
              {p.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 rounded-xl bg-brand-soft p-5 leading-8">
        برای اطلاع از تعرفه‌ها با ما در تماس باشید
        {SITE.contactEmail ? <>: <bdi dir="ltr">{SITE.contactEmail}</bdi></> : "."}
      </p>
    </div>
  );
}
