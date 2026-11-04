/**
 * Helpers for mixing English (Latin) words inside Persian (RTL) text
 * without the words jumping around.
 *
 * On the website we wrap each Latin run in <bdi dir="ltr">.
 * On social networks (plain text) we wrap each run in Unicode isolates:
 * FSI (U+2068) ... PDI (U+2069), and start each line with RLM (U+200F).
 */

// A run that starts and ends with a Latin letter or digit and may contain
// spaces and common punctuation in between (e.g. "Dublin City Council", "HAP", "Stamp 4", "€1,200").
// \p{Script=Latin} also covers accented letters such as the É in "RTÉ" or the á in "Dáil";
// with plain A-Z those letters fell outside the run and the word showed reversed ("ÉRT").
const LATIN_RUN = /[\p{Script=Latin}€£$][\p{Script=Latin}0-9€£$.,'’&@#%+/:_\- ]*[\p{Script=Latin}0-9%]|\p{Script=Latin}/gu;

export interface BidiSegment {
  text: string;
  latin: boolean;
}

export function splitBidi(text: string): BidiSegment[] {
  const segments: BidiSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN_RUN)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: text.slice(last, start), latin: false });
    segments.push({ text: match[0], latin: true });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), latin: false });
  return segments;
}

const RLM = "‏";
const FSI = "⁨";
const PDI = "⁩";

/** Plain-text version for Telegram, X, WhatsApp, Instagram etc. */
export function isolateForSocial(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;
      const isolated = splitBidi(line)
        .map((s) => (s.latin ? `${FSI}${s.text}${PDI}` : s.text))
        .join("");
      return RLM + isolated;
    })
    .join("\n");
}
