import type { Metadata } from "next";
import { Suspense } from "react";
import { getEpisodes, minutes, PODCAST } from "@/lib/podcasts";
import { formatDayFa } from "@/lib/dates";
import { SITE } from "@/lib/site";
import { BidiText } from "@/components/BidiText";

export const metadata: Metadata = {
  title: `پادکست «${PODCAST.name}»`,
  description: `${PODCAST.tagline}. پادکست شبانه ${SITE.name}.`,
  alternates: { canonical: "/podcast", types: { "application/rss+xml": "/podcast.xml" } },
};

export default function PodcastPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/podcast-cover.jpg" alt="" width={96} height={96} className="size-20 rounded-2xl sm:size-24" />
        <div>
          <h1 className="text-3xl font-black">🎙 {PODCAST.name}</h1>
          <p className="mt-1 text-muted">{PODCAST.tagline}</p>
          <p className="mt-2 text-sm">
            <a href={SITE.telegram} className="text-brand hover:underline">در تلگرام بشنوید</a>
            <span className="mx-2 text-muted">·</span>
            <a href="/podcast.xml" className="text-brand hover:underline">خوراک پادکست (RSS)</a>
          </p>
        </div>
      </div>
      <Suspense fallback={<p className="text-muted">در حال بارگذاری…</p>}>
        <Episodes />
      </Suspense>
    </div>
  );
}

async function Episodes() {
  const episodes = await getEpisodes(60);
  if (!episodes.length) return <p className="py-10 text-center text-muted">اولین قسمت به‌زودی، امشب ساعت ۱۰ منتشر می‌شود.</p>;
  return (
    <ul className="space-y-4">
      {episodes.map((e, i) => (
        <li key={e.id} className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-lg leading-8 font-black">
            {PODCAST.name} | {formatDayFa(e.episode_date)}
          </h2>
          <p className="mt-1 leading-8 font-semibold">
            <BidiText text={e.title} /> <span className="text-sm font-normal text-muted">· {minutes(e.duration_sec)}</span>
          </p>
          <p className="mt-1 leading-8 text-muted">
            <BidiText text={e.description} />
          </p>
          <audio controls preload={i === 0 ? "metadata" : "none"} src={e.audio_url} className="mt-3 w-full" />
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-brand">متن کامل این قسمت</summary>
            <div className="mt-2 space-y-3 leading-8 whitespace-pre-line">{e.script}</div>
          </details>
        </li>
      ))}
    </ul>
  );
}
