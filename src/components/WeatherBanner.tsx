import Link from "next/link";
import { BidiText } from "./BidiText";
import { LEVEL_FA, stillActive, whenFa, type WeatherAlert } from "@/lib/weather";

const TONE: Record<WeatherAlert["level"], string> = {
  yellow: "border-yellow-400 bg-yellow-50 text-yellow-950 dark:bg-yellow-950/40 dark:text-yellow-100",
  orange: "border-orange-500 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-100",
  red: "border-red-600 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100",
};

/** A strip on the home page while a weather warning is running or about to start. */
export function WeatherBanner({ alerts }: { alerts: WeatherAlert[] }) {
  const live = stillActive(alerts);
  if (!live.length) return null;
  const top = live[0];
  return (
    <Link href="/weather" className={`block rounded-2xl border-2 p-4 transition hover:opacity-90 ${TONE[top.level]}`}>
      <p className="font-black leading-8">
        {LEVEL_FA[top.level].emoji} <BidiText text={top.title_fa} />
      </p>
      <p className="mt-1 text-sm leading-7">
        از {whenFa(top.onset)} تا {whenFa(top.expiry, { isEnd: true })}
        {live.length > 1 && <> · و {(live.length - 1).toLocaleString("fa-IR")} هشدار دیگر</>}
      </p>
    </Link>
  );
}

export { TONE as WEATHER_TONE };
