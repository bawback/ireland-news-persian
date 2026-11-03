export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {/* Brand mark: «خ» (for «خبر») over the Irish tricolour, same as the app icon. */}
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-[#0f7a4d] shadow-sm"
      >
        <span className="text-[22px] leading-none font-black text-white">خ</span>
        <span dir="ltr" className="mt-1 flex gap-[2px]">
          <span className="h-[3px] w-[7px] rounded-full bg-[#3fbf86]" />
          <span className="h-[3px] w-[7px] rounded-full bg-white" />
          <span className="h-[3px] w-[7px] rounded-full bg-[#ff883e]" />
        </span>
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
