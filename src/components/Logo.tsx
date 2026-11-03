export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      {/* Brand mark: a shamrock in the Irish colours, same as the app icon. */}
      <svg aria-hidden viewBox="0 0 512 512" className="h-10 w-10 shrink-0 rounded-xl shadow-sm">
        <rect width="512" height="512" rx="112" fill="#0f7a4d" />
        <g transform="translate(256 250)">
          <path d="M0 0 C 2 60 14 110 40 160" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" />
          <path d="M0 -10 C -78 -66 -80 -168 0 -168 C 80 -168 78 -66 0 -10 Z" fill="#fff" />
          <path d="M0 -10 C -78 -66 -80 -168 0 -168 C 80 -168 78 -66 0 -10 Z" fill="#fff" transform="rotate(-120)" />
          <path d="M0 -10 C -78 -66 -80 -168 0 -168 C 80 -168 78 -66 0 -10 Z" fill="#ff883e" transform="rotate(120)" />
        </g>
      </svg>
      <span className="flex flex-col leading-tight">
        <span className="text-lg font-black tracking-tight sm:text-xl">اخبار ایرلند به فارسی</span>
        <span dir="ltr" className="text-right text-[11px] font-medium tracking-[0.2em] text-muted uppercase">
          Ireland News Persian
        </span>
      </span>
    </span>
  );
}
