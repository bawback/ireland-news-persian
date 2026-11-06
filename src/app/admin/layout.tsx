import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "پنل مدیریت",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-black text-brand">
            پنل مدیریت خبرها
          </Link>
          <Link href="/admin/podcasts" className="text-sm font-semibold hover:text-brand">
            🎙 پادکست
          </Link>
        </div>
        <form action={logout}>
          <button className="text-sm text-muted hover:text-accent">خروج</button>
        </form>
      </div>
      {children}
    </div>
  );
}
