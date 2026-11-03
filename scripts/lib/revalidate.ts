import { envOptional } from "./env";

/** Asks the website to refresh its cached pages. Safe to call when not configured. */
export async function refreshSite() {
  const site = envOptional("SITE_URL");
  const secret = envOptional("REVALIDATE_SECRET");
  if (!site || !secret) return;
  const res = await fetch(`${site}/api/revalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(20_000),
  }).catch((e) => e as Error);
  console.log("site refresh:", res instanceof Response ? res.status : String(res));
}
