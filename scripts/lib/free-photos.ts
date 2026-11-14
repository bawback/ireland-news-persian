/**
 * Real photos with a free licence from Wikimedia Commons, tried before an AI picture.
 *  1. A small model names the main subject of the story (a public figure, place, organisation or
 *     landmark). Stories about private people (victims, suspects, families) get no photo search.
 *  2. Wikimedia Commons is searched for that subject; only CC0, public domain, CC BY and CC BY-SA
 *     photos that are large enough and landscape are kept.
 *  3. The model looks at each candidate and only accepts one that really shows the subject.
 * The credit line names the author, Wikimedia Commons and the licence, as the licences require.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { CLASSIFIER_MODEL } from "./ai";
import { IMAGE_HEIGHT, IMAGE_WIDTH } from "./images";

const client = new Anthropic();
const UA = "IrelandNewsPersian/1.0 (https://www.irelandnewspersian.com)";

const SubjectSchema = z.object({
  search: z.boolean(),
  query: z.string(),
  subject: z.string(),
});

const SUBJECT_SYSTEM = `You help the photo editor of a Persian news site about Ireland find a REAL photo with a free licence on Wikimedia Commons.
From the article, pick the single most important visual subject that Commons is likely to have a good photo of:
- a well-known public figure (politician, minister, official, athlete, artist) who is central to the story,
- a specific place, building or landmark (e.g. "Leinster House", "Dublin Airport", "Cork city centre", "Croke Park"),
- a well-known organisation's building or vehicle (e.g. "Garda Síochána car", "Luas tram Dublin", "Aer Lingus aircraft").
"query": 1-4 English words for the Commons search, the plain name only (e.g. "Simon Harris", "Leinster House", "Dublin Airport terminal").
"subject": one short English sentence saying what the photo must show.
Set "search" to false (and leave query empty) when:
- the story is about private people (victims, suspects, defendants, families, ordinary residents) or a crime, death, accident or court case where a photo of a named person would be wrong,
- there is no specific, photographable subject (abstract topics like statistics, tax rules, the economy),
- the main subject is a person who is not a well-known public figure.`;

const CheckSchema = z.object({ fits: z.boolean(), score: z.number(), alt_fa: z.string() });

const CHECK_SYSTEM = `You check a candidate news photo for a Persian news site about Ireland.
Answer "fits": true only if the photo clearly shows the required subject (the right person, place or thing, not something else with a similar name), is a real, good-quality photo (not a map, logo, document, drawing, diagram, poster or screenshot), contains no large text overlays, and is suitable for a serious news site.
"score": 0-10 for how well it works as the article's cover photo.
"alt_fa": Persian description (8-20 words) of what the photo actually shows; do not start with «تصویر» or «عکس»; correct ZWNJ.`;

type Candidate = { title: string; url: string; thumb: string; width: number; height: number; artist: string; license: string; description: string; page: string };

const strip = (html: string) => html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
const OK_LICENSE = /^(cc0|public domain|pd|cc[ -]by(-sa)?[ -][0-9.]+)/i;

async function pickSubject(a: { title_fa: string; summary_fa: string; category: string; tags: string[]; source_title?: string | null }) {
  try {
    const res = await client.messages.parse({
      model: CLASSIFIER_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low", format: zodOutputFormat(SubjectSchema) },
      system: SUBJECT_SYSTEM,
      messages: [{ role: "user", content: `Category: ${a.category}\nTags: ${a.tags.join(", ")}\nOriginal English headline: ${a.source_title ?? ""}\nPersian headline: ${a.title_fa}\nSummary: ${a.summary_fa}` }],
    });
    const o = res.parsed_output;
    return o && o.search && o.query.trim() ? o : null;
  } catch (e) {
    console.warn("  subject pick failed:", String(e).slice(0, 200));
    return null;
  }
}

async function searchCommons(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "15",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1280",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return [];
  type Page = { title: string; index: number; imageinfo?: { url: string; thumburl: string; width: number; height: number; mime: string; descriptionurl: string; extmetadata?: Record<string, { value: string }> }[] };
  const json = (await res.json()) as { query?: { pages?: Record<string, Page> } };
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  const out: Candidate[] = [];
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !/jpeg|png/.test(ii.mime)) continue;
    if (ii.width < 1000 || ii.height < 560 || ii.width / ii.height < 1.2) continue;
    const m = ii.extmetadata ?? {};
    const license = strip(m.LicenseShortName?.value ?? "");
    if (!OK_LICENSE.test(license) || /nc|nd/i.test(license.replace(/^cc0/i, ""))) continue;
    if (/trademark/i.test(m.Restrictions?.value ?? "")) continue;
    out.push({
      title: p.title,
      url: ii.url,
      thumb: ii.thumburl,
      width: ii.width,
      height: ii.height,
      artist: strip(m.Artist?.value ?? "").slice(0, 80) || "Unknown",
      license,
      description: strip(m.ImageDescription?.value ?? "").slice(0, 300),
      page: ii.descriptionurl,
    });
  }
  return out;
}

async function download(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

async function check(c: Candidate, subject: string, headline: string, raw: Buffer) {
  const small = await sharp(raw).resize(768, 432, { fit: "inside" }).jpeg({ quality: 80 }).toBuffer();
  try {
    const res = await client.messages.parse({
      model: CLASSIFIER_MODEL,
      max_tokens: 1500,
      output_config: { effort: "low", format: zodOutputFormat(CheckSchema) },
      system: CHECK_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: small.toString("base64") } },
            { type: "text", text: `Required subject: ${subject}\nArticle headline: ${headline}\nCommons file: ${c.title}\nCommons description: ${c.description}` },
          ],
        },
      ],
    });
    return res.parsed_output ?? null;
  } catch (e) {
    console.warn("  photo check failed:", String(e).slice(0, 200));
    return null;
  }
}

export type FreePhoto = { webp: Buffer; credit: string; alt_fa: string; source: string };

export async function findFreePhoto(a: { title_fa: string; summary_fa: string; category: string; tags: string[]; source_title?: string | null }): Promise<FreePhoto | null> {
  const s = await pickSubject(a);
  if (!s) {
    console.log("  no photo subject; using an AI picture");
    return null;
  }
  const candidates = (await searchCommons(s.query).catch(() => [])).slice(0, 4);
  console.log(`  Commons "${s.query}": ${candidates.length} candidates`);
  for (const c of candidates) {
    const raw = await download(c.thumb);
    if (!raw) continue;
    const v = await check(c, s.subject, a.title_fa, raw);
    if (!v?.fits || v.score < 7) continue;
    const webp = await sharp(raw).resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover", position: sharp.strategy.attention }).webp({ quality: 82 }).toBuffer();
    console.log(`  ✓ photo: ${c.title} (${c.license}, score ${v.score})`);
    return { webp, credit: `عکس: ${c.artist} / Wikimedia Commons، ${c.license}`, alt_fa: v.alt_fa, source: c.page };
  }
  return null;
}
