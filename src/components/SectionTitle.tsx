import Link from "next/link";

export function SectionTitle({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <span aria-hidden className="h-6 w-1.5 rounded-full bg-brand" />
        {title}
      </h2>
      {href && (
        <Link href={href} className="text-sm font-semibold text-brand hover:underline">
          همه ←
        </Link>
      )}
    </div>
  );
}
