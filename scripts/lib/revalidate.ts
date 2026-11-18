import { envOptional } from "./env";

/** Must match INDEXNOW_KEY in src/lib/site.ts (served at /indexnow-key.txt). */
const INDEXNOW_KEY = "b7c41e2a9d6f4e0c8a3b5d1f7e9c2a64";

/**
 * Asks the website to refresh its cached pages. Safe to call when not configured.
 * `newPaths` (e.g. "/news/some-slug") are new or changed pages: they are also sent to IndexNow,
 * so Bing (and the other IndexNow engines) crawl them within minutes instead of days.
 */
export async function refreshSite(newPaths: string[] = []) {
  const site = envOptional("SITE_URL");
  const secret = envOptional("REVALIDATE_SECRET");
  if (!site || !secret) return;
  const res = await fetch(`${site}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => e as Error);
  console.log("site refresh:", res instanceof Response ? res.status : String(res));
  if (newPaths.length) await pingIndexNow(site, newPaths);
}

async function pingIndexNow(site: string, paths: string[]) {
  const base = site.replace(/\/+$/, "");
  if (!/^https:\/\//.test(base)) return; // never from local development
  const host = new URL(base).host;
  // The home page and the archive change with every new article too.
  const urlList = [...new Set([...paths.map((p) => `${base}${p}`), `${base}/`, `${base}/news`])];
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${base}/indexnow-key.txt`, urlList }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => e as Error);
  console.log("IndexNow:", res instanceof Response ? res.status : String(res), `(${urlList.length} URLs)`);
}
