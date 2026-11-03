import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/content/guides";
import { formatFaDate } from "@/lib/dates";
import { BidiText } from "@/components/BidiText";

export const metadata: Metadata = {
  title: "راهنماهای زندگی در ایرلند",
  description: "راهنماهای کاربردی و به‌روز فارسی برای زندگی در ایرلند: اقامت، تمدید IRP، کار، مسکن و مالیات.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-3xl font-black">راهنماهای زندگی در ایرلند</h1>
      <p className="mb-8 text-muted">راهنماهای کاربردی و به‌روز، بر پایه منابع رسمی ایرلند.</p>
      <ul className="space-y-4">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/guides/${g.slug}`}
              className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-brand"
            >
              <h2 className="text-xl leading-9 font-black">
                <BidiText text={g.title} />
              </h2>
              <p className="mt-2 leading-8 text-muted">
                <BidiText text={g.description} />
              </p>
              <p className="mt-3 text-sm text-muted">به‌روزرسانی: {formatFaDate(g.updated)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
