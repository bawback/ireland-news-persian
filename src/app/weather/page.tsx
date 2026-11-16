import type { Metadata } from "next";
import { cacheLife } from "next/cache";
import { getWeatherAlerts } from "@/lib/weather-alerts";
import { LEVEL_FA, SOURCE_NAME, SOURCE_PAGE, adviceFa, alertAnchor, stillActive, typesFa, whenFa } from "@/lib/weather";
import { BidiText } from "@/components/BidiText";
import { WEATHER_TONE } from "@/components/WeatherBanner";

export const metadata: Metadata = {
  title: "هشدارهای هواشناسی ایرلند",
  description: "هشدارهای رسمی هواشناسی ایرلند و ایرلند شمالی به فارسی: طوفان، باد شدید و باران، با روز و ساعت دقیق شروع و پایان.",
  alternates: { canonical: "/weather" },
};

export default async function WeatherPage() {
  "use cache";
  cacheLife("minutes");
  const alerts = stillActive(await getWeatherAlerts());
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-2 text-3xl font-black">هشدارهای هواشناسی</h1>
      <p className="mb-8 leading-8 text-muted">
        هشدارهای رسمی <bdi dir="ltr">Met Éireann</bdi> برای ایرلند و <bdi dir="ltr">Met Office</bdi> برای ایرلند شمالی، به فارسی. همه ساعت‌ها به
        وقت ایرلند است. هشدار هر شهر چند ساعت پیش از شروع در کانال تلگرام هم یادآوری می‌شود.
      </p>
      {alerts.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-8 text-center text-muted">در حال حاضر هشدار هواشناسی فعالی نیست. ☀️</p>
      ) : (
        <ul className="space-y-5">
          {alerts.map((a) => (
            <li key={a.key} id={alertAnchor(a.key)} className={`scroll-mt-28 rounded-2xl border-2 p-5 ${WEATHER_TONE[a.level]}`}>
              <p className="text-sm font-bold">
                {LEVEL_FA[a.level].emoji} هشدار {LEVEL_FA[a.level].name} · {typesFa(a.types)}
              </p>
              <h2 className="mt-1 text-xl leading-9 font-black">
                <BidiText text={a.title_fa} />
              </h2>
              <p className="mt-2 font-bold">📍 {a.areas_fa}</p>
              <dl className="mt-3 grid gap-1 text-[15px] leading-7 sm:grid-cols-2">
                <div>
                  <dt className="inline font-bold">شروع: </dt>
                  <dd className="inline">{whenFa(a.onset)}</dd>
                </div>
                <div>
                  <dt className="inline font-bold">پایان: </dt>
                  <dd className="inline">{whenFa(a.expiry, { isEnd: true })}</dd>
                </div>
              </dl>
              {a.body_fa && (
                <div className="mt-4 space-y-3 leading-8">
                  {a.body_fa.split(/\n+/).map((p, i) => (
                    <p key={i}>
                      <BidiText text={p} />
                    </p>
                  ))}
                </div>
              )}
              <p className="mt-4 leading-8">
                <span className="font-bold">توصیه ما: </span>
                {adviceFa(a.level, a.types)}
              </p>
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-bold">متن اصلی هشدار (انگلیسی)</summary>
                <p dir="ltr" className="mt-2 text-left leading-7">
                  {a.headline_en}
                </p>
              </details>
              <p className="mt-4 text-sm">
                منبع:{" "}
                <a href={a.link || SOURCE_PAGE[a.source]} className="underline" rel="noopener">
                  <bdi dir="ltr">{SOURCE_NAME[a.source]}</bdi>
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm leading-7 text-muted">
        ترجمه فارسی این هشدارها برای آگاهی شماست؛ متن رسمی و به‌روز همیشه در سایت{" "}
        <a href={SOURCE_PAGE.met_eireann} className="underline" rel="noopener">
          <bdi dir="ltr">met.ie/warnings</bdi>
        </a>{" "}
        است.
      </p>
    </div>
  );
}
