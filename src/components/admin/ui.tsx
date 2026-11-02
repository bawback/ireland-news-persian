import { STATUS_LABELS } from "@/lib/admin/db";

export function StatusBadge({ status }: { status: string }) {
  const color = status === "published" ? "bg-brand-soft text-brand" : status === "rejected" ? "bg-line text-muted" : "bg-accent-soft text-accent";
  return <span className={`rounded-full px-2 py-0.5 font-semibold ${color}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function Notice({ children, error }: { children: React.ReactNode; error?: boolean }) {
  return (
    <p className={`rounded-lg px-4 py-2 text-sm font-semibold ${error ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand"}`}>{children}</p>
  );
}
