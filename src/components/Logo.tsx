export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <span aria-hidden dir="ltr" className="flex h-9 w-9 overflow-hidden rounded-lg shadow-sm ring-1 ring-line">
        <span className="w-1/3 bg-[#169b62]" />
        <span className="w-1/3 bg-white" />
        <span className="w-1/3 bg-[#ff883e]" />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-black tracking-tight sm:text-xl">اخبار ایرلند به فارسی</span>
        <span dir="ltr" className="text-right text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
          Ireland News Persian
        </span>
      </span>
    </span>
  );
}
