import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CATEGORIES } from "../../src/lib/categories";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

export const WRITER_MODEL = process.env.WRITER_MODEL ?? "claude-opus-5-5";
export const CLASSIFIER_MODEL = process.env.CLASSIFIER_MODEL ?? "claude-haiku-5-5";

const categorySlugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

// ---------------------------------------------------------------------------
// 1) Classification: cheap, fast filter for many raw headlines at once
// ---------------------------------------------------------------------------

const ClassificationSchema = z.object({
  items: z.array(
    z.object({
      index: z.number().int(),
      relevant: z.boolean(),
      category: z.enum(categorySlugs),
      immigrant_relevance: z.number().int().min(0).max(3),
      importance: z.number().int().min(1).max(5),
      sensitive: z.boolean(),
      story_key: z.string(),
    }),
  ),
});
export type Classification = z.infer<typeof ClassificationSchema>["items"][number];

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
  const response = await client.messages.parse({
    model: CLASSIFIER_MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(ClassificationSchema) },
    system: CLASSIFIER_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(items) }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  return response.parsed_output.items;
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
  confidence: z.enum(["high", "medium", "low"]),
  notes_for_editor: z.string(),
});
export type WrittenArticle = z.infer<typeof ArticleSchema>;

const STYLE_GUIDE = `
WRITING STYLE (Persian)
- Write fluent, natural, standard Persian as used by professional Persian news media. Never translate word-for-word; never sound machine-translated.
- Use correct zero-width non-joiners (می‌شود، خانه‌ها، نمی‌خواهد), Persian punctuation (« » ، ؛ ؟) and Persian digits (۰-۹) for numbers in Persian sentences.
- Names of people and places: write them in Persian script, and on FIRST mention add the original English in parentheses, e.g. «سایمون هریس (Simon Harris)»، «کورک (Cork)». After that use the Persian form only.
- Organisations and acronyms: on first mention give a clear Persian name followed by the original acronym or name in parentheses, e.g. «اداره خدمات مهاجرت ایرلند (ISD)»، «سازمان بهداشت ایرلند (HSE)». Common English terms that immigrants need to recognise (PPS، IRP، Stamp 4، HAP) may stay in English.
- Money: «۱٬۲۰۰ یورو»، «۳ میلیون پوند». Dates: Gregorian, written in Persian, e.g. «۳۱ اکتبر ۲۰۲۶». Do NOT convert to the Persian (Jalali) calendar.
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
  mode: "translation" | "report";
  sourceName: string;
  title: string;
  publishedAt: string;
  text: string;
}): Promise<WrittenArticle | null> {
  const response = await client.beta.messages.parse({
    model: WRITER_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(ArticleSchema) },
    cache_control: { type: "ephemeral" },
    system: input.mode === "translation" ? TRANSLATION_SYSTEM : REPORT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Source: ${input.sourceName}\nPublished: ${input.publishedAt}\nOriginal headline: ${input.title}\n\n<source_text>\n${input.text}\n</source_text>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    console.warn(`  refused: ${input.title}`);
    return null;
  }
  if (response.stop_reason === "max_tokens") {
    console.warn(`  output cut off: ${input.title}`);
    return null;
  }
  return response.parsed_output ?? null;
}
