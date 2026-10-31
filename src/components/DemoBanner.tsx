import { isDemo } from "@/lib/articles";

export function DemoBanner() {
  if (!isDemo) return null;
  return (
    <div className="bg-accent-soft px-4 py-2 text-center text-sm text-ink">
      نسخه نمایشی: پایگاه داده هنوز وصل نشده و مطالب این صفحه نمونه هستند.
    </div>
  );
}
