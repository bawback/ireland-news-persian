import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-3xl font-black">این صفحه پیدا نشد</h1>
      <p className="mt-3 text-muted">ممکن است خبر حذف شده یا نشانی اشتباه باشد.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-brand px-6 py-2.5 font-bold text-white">
        بازگشت به صفحه اصلی
      </Link>
    </div>
  );
}
