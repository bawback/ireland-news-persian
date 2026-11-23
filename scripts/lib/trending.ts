/**
 * "What is Ireland talking about right now?" signals for the news pipeline.
 *
 *  - RTÉ's "Most Read" list (the same box shown beside every rte.ie news story).
 *  - Mentions of RTÉ Radio 1 current-affairs programmes in a story ("told RTÉ's Morning Ireland"),
 *    which usually means the story is being argued about on air that day.
 *
 * Both only raise a story's score; neither can make an irrelevant story relevant.
 */
import { normaliseUrl } from "./feeds";

const MOST_READ_URL = "https://www.rte.ie/modules/most-popular/news/";

/** URL (normalised) → rank in RTÉ's Most Read list (1 = most read). Empty when the page is unreachable. */
export async function rteMostRead(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const res = await fetch(MOST_READ_URL, {
      headers: { "User-Agent": "IrelandNewsPersianBot/1.0 (+https://github.com)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    for (const m of html.matchAll(/class="most-popular-page-list-item__link"[^>]*?href="([^"]+)"|href="([^"]+)"[^>]*?class="most-popular-page-list-item__link"/g)) {
      const href = m[1] ?? m[2];
      const url = normaliseUrl(new URL(href, "https://www.rte.ie").toString());
      if (!out.has(url)) out.set(url, out.size + 1);
    }
  } catch (e) {
    console.warn(`✗ RTÉ Most Read: ${String(e).slice(0, 120)}`);
  }
  return out;
}

// RTÉ Radio 1 news and current-affairs programmes (and RTÉ's TV debate shows).
const RADIO_PROGRAMMES =
  /\b(morning ireland|news at one|today with (claire byrne|david mccullagh)|liveline|drivetime|rt[ée]'s this week|the week in politics|rt[ée]'s prime time|claire byrne live)\b/i;

/** True when the story mentions an RTÉ Radio 1 current-affairs programme. */
export function onRteRadio(text: string): boolean {
  return RADIO_PROGRAMMES.test(text);
}
