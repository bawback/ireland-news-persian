/**
 * Northern Ireland label. Every story that happens in Northern Ireland is marked «ایرلند شمالی» on the
 * website and in the channel posts, whatever its topic category (sport, economy, crime ...), so that
 * readers in the Republic never mistake a Belfast story for a Dublin one.
 *
 * New articles carry the region the classifier chose in `social.region`. Older articles have no region;
 * for them it is worked out from the category, the source and the original English headline.
 */

/** "ni" = Northern Ireland, "roi" = Republic of Ireland, "both" = all-island or cross-border, "other" = neither. */
export type Region = "ni" | "roi" | "both" | "other";

export const NI_NAME = "ایرلند شمالی";
export const NI_BADGE = `📍 ${NI_NAME}`;
export const NI_HASHTAG = "#ایرلند_شمالی";

/** Feeds that carry only Northern Ireland news (ids from scripts/sources.ts, hint "northern-ireland"). */
export const NI_SOURCE_IDS = new Set(["bbc-ni", "belfast-telegraph", "nidirect"]);

// Strong signs in English text that a story is set in Northern Ireland. Ambiguous words are left out on
// purpose: "Ulster" (Donegal, Cavan and Monaghan are in Ulster too), bare county names like "Tyrone" or
// "Armagh" (GAA teams that play all over the island) and "Bangor" (also in Wales).
const NI_PATTERN = new RegExp(
  [
    "northern ireland",
    "northern irish",
    "belfast",
    "stormont",
    "psni",
    "derry",
    "londonderry",
    "(?:co\\.?|county) (?:antrim|armagh|down|fermanagh|tyrone|londonderry)",
    "newry",
    "lisburn",
    "ballymena",
    "coleraine",
    "enniskillen",
    "omagh",
    "portadown",
    "craigavon",
    "newtownabbey",
    "carrickfergus",
    "dungannon",
    "ni executive",
    "ni assembly",
    "ni water",
    "translink",
    "nidirect",
    "dup",
    "uup",
    "sdlp",
    "ulster unionist",
  ]
    .map((w) => `\\b${w}\\b`)
    .join("|"),
  "i",
);

/** True when English text (a headline, a summary) clearly names a Northern Ireland place or institution. */
export function mentionsNorthernIreland(text: string): boolean {
  return NI_PATTERN.test(text);
}

export function normaliseRegion(value: unknown): Region | null {
  const v = String(value ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "ni" || v === "northern_ireland") return "ni";
  if (v === "roi" || v === "republic" || v === "republic_of_ireland" || v === "ireland") return "roi";
  if (v === "both" || v === "all_island" || v === "cross_border") return "both";
  if (v === "other" || v === "none") return "other";
  return null;
}

/**
 * The region of a new story, from everything known at ingest. The classifier decides; the source and
 * the headline only decide when the classifier gave no clear answer (it said "other" or nothing).
 */
export function decideRegion(input: { classifier?: string | null; category: string; sourceIsNi: boolean; text: string }): Region {
  const r = normaliseRegion(input.classifier);
  if (input.category === "northern-ireland" || r === "ni") return "ni";
  if (r === "roi" || r === "both") return r;
  if (input.sourceIsNi || mentionsNorthernIreland(input.text)) return "ni";
  return r ?? "other";
}

type RegionFields = {
  category: string;
  social?: { region?: string | null } | null;
  source_id?: string | null;
  source_title?: string | null;
};

/** Should this article show the Northern Ireland label? */
export function isNorthernIreland(a: RegionFields): boolean {
  if (a.category === "northern-ireland") return true;
  const r = normaliseRegion(a.social?.region);
  if (r) return r === "ni";
  return (!!a.source_id && NI_SOURCE_IDS.has(a.source_id)) || mentionsNorthernIreland(a.source_title ?? "");
}

const startsWithBadge = (text: string) => text.trimStart().startsWith(NI_BADGE);

/** Puts «📍 ایرلند شمالی» on its own first line of a social post. Safe to call twice. */
export function labelPost(text: string): string {
  if (!text.trim() || startsWithBadge(text)) return text;
  return `${NI_BADGE}\n${text.trimStart()}`;
}

/** Adds #ایرلند_شمالی to the post's hashtag line (the last line, when it is made of hashtags). */
export function addNiHashtag(text: string): string {
  if (text.includes(NI_HASHTAG)) return text;
  const lines = text.trimEnd().split("\n");
  const last = lines[lines.length - 1]?.trim() ?? "";
  if (!last.startsWith("#")) return text;
  lines[lines.length - 1] = `${last} ${NI_HASHTAG}`;
  return lines.join("\n");
}

type SocialPosts = { telegram?: string; x?: string; instagram?: string; whatsapp?: string };

/**
 * The stored social posts of a Northern Ireland story, with the label on X, Instagram and WhatsApp and
 * the hashtag on Telegram and Instagram. (The Telegram label is added when the post is sent, so that
 * the headline stays the bold line.)
 */
export function labelSocialPosts<T extends SocialPosts>(posts: T, ni: boolean): T {
  if (!ni) return posts;
  const out = { ...posts };
  if (out.telegram) out.telegram = addNiHashtag(out.telegram);
  if (out.x) out.x = labelPost(out.x);
  if (out.instagram) out.instagram = addNiHashtag(labelPost(out.instagram));
  if (out.whatsapp) out.whatsapp = labelPost(out.whatsapp);
  return out;
}

/** Removes a leading label line, so a post that already has it is not labelled twice. */
export function stripLabel(text: string): string {
  return startsWithBadge(text) ? text.trimStart().slice(NI_BADGE.length).replace(/^\s*\n/, "") : text;
}
