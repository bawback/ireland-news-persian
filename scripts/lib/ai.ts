import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CATEGORIES } from "../../src/lib/categories";
import { applyWordFixes, findMixedWords, fixPersian } from "./fa-fixes";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

/**
 * Writer models. Defaults are chosen to keep costs very low while there is no income:
 *  - everyday stories: Claude Haiku 5.5 (cheapest)
 *  - important stories (importance >= 4, or essential for immigrants): set WRITER_MODEL_IMPORTANT
 *    to "claude-sonnet-5-5" or "claude-opus-5-5" for higher quality when the budget allows.
 */
export const WRITER_MODEL = process.env.WRITER_MODEL ?? "claude-haiku-5-5";
export const WRITER_MODEL_IMPORTANT =
  process.env.WRITER_MODEL_IMPORTANT ?? WRITER_MODEL;
export const CLASSIFIER_MODEL =
  process.env.CLASSIFIER_MODEL ?? "claude-haiku-5-5";

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

// ---------------------------------------------------------------------------
// 1) Classification: cheap, fast filter for many raw headlines at once
// ---------------------------------------------------------------------------

const ClassificationSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      relevant: z.boolean(),
      // Kept loose on purpose: the model occasionally strays, and one bad value
      // must not throw away a whole batch. Values are normalised in classifyItems().
      category: z.string(),
      immigrant_relevance: z.number(),
      importance: z.number(),
      sensitive: z.boolean(),
      story_key: z.string(),
    }),
  ),
});
export type Classification = z.infer<
  typeof ClassificationSchema
>["items"][number];

const CLASSIFIER_SYSTEM = `You triage news headlines for "Ireland News Persian", a Persian-language news service for Persian speakers living in the Republic of Ireland and Northern Ireland.

For every item decide:
- relevant: true only if the story is about Ireland or Northern Ireland (events, people, laws, economy, sport, culture there) or directly affects people living there. World news with no Irish angle is not relevant. Pure celebrity gossip, horoscopes, sponsored content and live blogs are not relevant.
- category: one of ${categorySlugs.join(", ")}. Use "northern-ireland" for stories based in Northern Ireland unless a more specific topic dominates. Use "community" only for stories about Iranians or Persian speakers in Ireland.
- immigrant_relevance: 0 none, 1 slightly, 2 clearly useful for immigrants (cost of living, rent, jobs, tax, public services), 3 essential for immigrants (visas, residence permits, citizenship, employment permits, asylum, rules for non-EU nationals, anything about Iran or Iranians).
- importance: 1 minor local story ... 5 major national story.
- sensitive: true for crime, court cases, deaths, allegations against named people, or anything with legal or defamation risk.
- story_key: a short lowercase English key describing the underlying event (e.g. "budget-2027-tax-bands", "dublin-airport-passenger-cap"), so that two articles about the same event from different outlets get the same key.`;

export async function classifyItems(
  items: { index: number; source: string; title: string; summary: string }[],
): Promise<Classification[]> {
  try {
    const response = await client.messages.parse({
      model: CLASSIFIER_MODEL,
      max_tokens: 16000,
      output_config: {
        effort: "low",
        format: zodOutputFormat(ClassificationSchema),
      },
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(items) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output)
      return [];
    return response.parsed_output.items.map((c) => ({
      ...c,
      category: categorySlugs.includes(c.category) ? c.category : "ireland",
      immigrant_relevance: clamp(c.immigrant_relevance, 0, 3),
      importance: clamp(c.importance, 1, 5),
    }));
  } catch (e) {
    console.warn("  classification batch failed:", String(e).slice(0, 300));
    return [];
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : min)));
}

// ---------------------------------------------------------------------------
// 2) Writing: translation (open licence) or original report (media)
// ---------------------------------------------------------------------------

const ArticleSchema = z.object({
  title_fa: z.string(),
  summary_fa: z.string(),
  body_fa: z.string(),
  tags: z.array(z.string()),
  slug: z.string(),
  telegram_post: z.string(),
  x_post: z.string(),
  instagram_caption: z.string(),
  whatsapp_post: z.string(),
  confidence: z.string(), // "high" | "medium" | "low", normalised in writeArticle()
  notes_for_editor: z.string(),
});
export type WrittenArticle = Omit<
  z.infer<typeof ArticleSchema>,
  "confidence"
> & {
  confidence: "high" | "medium" | "low";
};

const STYLE_GUIDE = `
WRITING STYLE (Persian)
- Write fluent, natural, standard Persian as used by professional Persian news media. Never translate word-for-word; never sound machine-translated.
- Use correct zero-width non-joiners (می‌شود، خانه‌ها، نمی‌خواهد), Persian punctuation (« » ، ؛ ؟) and Persian digits (۰-۹) for numbers in Persian sentences.
- Names of people and places — choose by how familiar the name is to Persian readers:
  • Well-known names that Persian media already write in Persian (major cities and counties, countries, very well-known people and institutions): write them in Persian script, and on FIRST mention add the original English in parentheses, e.g. «سایمون هریس (Simon Harris)»، «کورک (Cork)». After that use the Persian form only.
  • Unfamiliar names that would look strange, be hard to read or be ambiguous in Persian letters — most Irish-language names and words (e.g. Aengus Ó Snodaigh, Oireachtas, Fiosrú, Ceann Comhairle, Dáil, Garda Síochána when not translated), small towns and villages (e.g. Tralee, Enniskillen), lesser-known people, companies and brands: write them in English letters exactly as in the source, as a separate word with spaces around it, e.g. «نماینده Sinn Féin، Aengus Ó Snodaigh، گفت...». Where a clear Persian description helps, add it before the name, e.g. «شهر Tralee»، «پارلمان ایرلند (Oireachtas)».
  • Never write a name half in Persian letters and half in English letters.
- Organisations and acronyms: on first mention give a clear Persian name followed by the original acronym or name in parentheses, e.g. «اداره خدمات مهاجرت ایرلند (ISD)»، «سازمان بهداشت ایرلند (HSE)». Common English terms that immigrants need to recognise (PPS، IRP، Stamp 4، HAP) may stay in English.
- Money: «۱٬۲۰۰ یورو»، «۳ میلیون پوند». Dates: Gregorian, written in Persian, e.g. «۳۱ اکتبر ۲۰۲۶». Do NOT convert to the Persian (Jalali) calendar.
- Fixed spellings of common place names (always use exactly these): Dublin = «دابلین» (never «دوبلین»), Cork = «کورک», Galway = «گالوی», Limerick = «لیمریک», Belfast = «بلفاست», Waterford = «واترفورد», Kerry = «کری», Donegal = «دانگال», Derry = «دری», Northern Ireland = «ایرلند شمالی».
- Every Persian word must be written fully in Persian letters. Never mix Persian and English letters inside one word.
- Keep English words as separate tokens with normal spaces around them; never glue Persian letters to English words.
- Neutral, factual tone. No opinions, no speculation, no exaggeration, no clickbait.
- NEVER add facts, numbers, names or context that are not in the source text. If something is unclear in the source, leave it out and mention it in notes_for_editor.

BODY FORMAT (body_fa)
- Paragraphs separated by one blank line.
- For longer pieces, use subheadings on their own line starting with "## ".
- Lists: each item on its own line starting with "- ".
- No markdown bold, italics, links, tables or images.

OTHER FIELDS
- title_fa: clear news headline, max ~14 words, no clickbait.
- summary_fa: 1–2 sentences (max ~45 words) with the core news.
- tags: 3–6 short Persian tags.
- slug: 3–8 lowercase English words joined by hyphens, based on the story (ASCII only).
- telegram_post: first line = one fitting emoji + the headline; then 2–4 short lines with the key facts; last line = 3–5 Persian hashtags using underscores (e.g. #اخبار_ایرلند #مهاجرت). Do not include any URL.
- x_post: max 220 characters, headline-style summary, 1–2 hashtags, no URL.
- instagram_caption: 3–5 short paragraphs, friendly but factual, then 5–8 hashtags, no URL.
- whatsapp_post: 2–3 short lines, no hashtags, no URL.
- confidence: "high" only if the source text was complete and clear; "medium" if parts were missing; "low" if you only had a headline or snippet.
- notes_for_editor: in Persian, anything the human editor should double-check (or an empty string).`;

const TRANSLATION_SYSTEM = `You are the senior editor of «اخبار ایرلند به فارسی» (Ireland News Persian), writing for Persian speakers who live in Ireland and Northern Ireland, many of them Iranian immigrants.

TASK: produce a COMPLETE and FAITHFUL Persian translation of an official government text that is published under an open licence. Translate everything that carries information: do not summarise, do not omit, do not add, and do not change the meaning. You may drop navigation text, cookie notices and repeated boilerplate. Keep the original structure (headings, lists) where it helps the reader.
${STYLE_GUIDE}`;

const REPORT_SYSTEM = `You are the senior editor of «اخبار ایرلند به فارسی» (Ireland News Persian), writing for Persian speakers who live in Ireland and Northern Ireland, many of them Iranian immigrants.

TASK: write an ORIGINAL Persian news report based on the facts in a copyrighted news article. Copyright protects the wording, not the facts, so:
- Include every important fact: what happened, who, where, when, numbers, decisions, deadlines, and what happens next. The meaning must stay exactly the same as the source.
- Write it in your own words and your own structure, in standard news style (most important information first). Do NOT reproduce the source sentence by sentence or paragraph by paragraph.
- Direct quotes: at most two short quotes (one sentence each), translated, with the speaker named. Report other statements in indirect speech.
- Length: as long as needed to cover all the facts, usually 200–600 Persian words.
- The source outlet is credited automatically below the article; do not write "according to [outlet]" in every paragraph (once is fine).
${STYLE_GUIDE}`;

export async function writeArticle(input: {
  model?: string;
  mode: "translation" | "report";
  sourceName: string;
  title: string;
  publishedAt: string;
  text: string;
}): Promise<WrittenArticle | null> {
  const model = input.model ?? WRITER_MODEL;
  // Server-side refusal fallbacks exist for Opus and Sonnet, not for Haiku.
  const supportsFallback = /opus|sonnet/.test(model);
  let response;
  try {
    response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      ...(supportsFallback
        ? {
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }
        : {}),
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(ArticleSchema),
      },
      cache_control: { type: "ephemeral" },
      system: input.mode === "translation" ? TRANSLATION_SYSTEM : REPORT_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Source: ${input.sourceName}\nPublished: ${input.publishedAt}\nOriginal headline: ${input.title}\n\n<source_text>\n${input.text}\n</source_text>`,
        },
      ],
    });
  } catch (e) {
    console.warn(`  writer failed: ${input.title}:`, String(e).slice(0, 300));
    return null;
  }
  if (response.stop_reason === "refusal") {
    console.warn(`  refused: ${input.title}`);
    return null;
  }
  if (response.stop_reason === "max_tokens") {
    console.warn(`  output cut off: ${input.title}`);
    return null;
  }
  const out = response.parsed_output;
  if (!out) return null;
  const c = out.confidence.toLowerCase();
  return {
    ...out,
    title_fa: fixPersian(out.title_fa),
    summary_fa: fixPersian(out.summary_fa),
    body_fa: fixPersian(out.body_fa),
    tags: out.tags.map(fixPersian),
    telegram_post: fixPersian(out.telegram_post),
    x_post: fixPersian(out.x_post),
    instagram_caption: fixPersian(out.instagram_caption),
    whatsapp_post: fixPersian(out.whatsapp_post),
    confidence: c === "high" || c === "medium" ? c : "low",
  };
}

// ---------------------------------------------------------------------------
// 3) Repair: words the writer left half Persian, half English (e.g. «بلفast»)
// ---------------------------------------------------------------------------

const RepairSchema = z.object({ fixes: z.array(z.object({ broken: z.string(), fixed: z.string() })) });

/**
 * Asks the cheap model for the correct Persian spelling of each broken word,
 * using the sentence it appears in. Returns broken → fixed (only safe, fully Persian answers).
 */
export async function repairMixedWords(texts: string[]): Promise<Map<string, string>> {
  const broken = findMixedWords(...texts);
  const result = new Map<string, string>();
  if (!broken.length) return result;
  const joined = texts.join("\n");
  const items = broken.map((w) => {
    const i = joined.indexOf(w);
    return { broken: w, context: joined.slice(Math.max(0, i - 120), i + w.length + 120).replace(/\s+/g, " ") };
  });
  try {
    const res = await client.messages.parse({
      model: CLASSIFIER_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(RepairSchema) },
      system: `You fix broken words in Persian news text about Ireland. Each "broken" word is a Persian transliteration of a name or word (usually an Irish/English place, person or organisation) that was cut off and finished in English letters, e.g. «بلفast» → «بلفاست», «لیمرick» → «لیمریک», «تralee» → «ترالی», «دوblin» → «دابلین». Use the context to identify the original name. If the name is well known to Persian readers (major Irish cities and counties, well-known people), return the complete standard Persian spelling, written only in Persian letters (keep any Persian suffix such as «‌ها» or a trailing «،»); Dublin is always «دابلین». If it is an unfamiliar name that would be hard to read in Persian letters (Irish-language words, small towns, lesser-known people or companies), return the original English spelling instead, e.g. «تralee» → «Tralee», «اوireachtas» → «Oireachtas», keeping a trailing «،» if there was one. If the item is really an English word or acronym followed by Persian punctuation or a Persian suffix (e.g. «HSE،», «RTÉها»), return it unchanged apart from inserting a space or ZWNJ between the English part and the Persian part.`,
      messages: [{ role: "user", content: JSON.stringify(items) }],
    });
    for (const f of res.parsed_output?.fixes ?? []) {
      if (!broken.includes(f.broken) || !f.fixed.trim() || f.fixed === f.broken) continue;
      // Accept only answers that no longer glue Persian and English letters together.
      if (findMixedWords(f.fixed).length) continue;
      result.set(f.broken, f.fixed.trim());
    }
  } catch (e) {
    console.warn("  word repair failed:", String(e).slice(0, 300));
  }
  return result;
}

/** Runs the regex fixes and the AI word repair over every Persian field of a written article. */
export async function cleanArticle(a: WrittenArticle): Promise<WrittenArticle> {
  const fields = [a.title_fa, a.summary_fa, a.body_fa, a.telegram_post, a.x_post, a.instagram_caption, a.whatsapp_post, ...a.tags];
  const fixes = await repairMixedWords(fields);
  if (fixes.size) console.log("  repaired words:", [...fixes].map(([b, f]) => `${b}→${f}`).join(", "));
  const fix = (t: string) => applyWordFixes(t, fixes);
  return {
    ...a,
    title_fa: fix(a.title_fa),
    summary_fa: fix(a.summary_fa),
    body_fa: fix(a.body_fa),
    tags: a.tags.map(fix),
    telegram_post: fix(a.telegram_post),
    x_post: fix(a.x_post),
    instagram_caption: fix(a.instagram_caption),
    whatsapp_post: fix(a.whatsapp_post),
  };
}
