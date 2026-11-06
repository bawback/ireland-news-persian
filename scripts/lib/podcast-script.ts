import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { PODCAST_NAME } from "./ai";

const client = new Anthropic();
const MODEL = process.env.PODCAST_MODEL ?? "claude-sonnet-5-5";

const ScriptSchema = z.object({
  episode_title: z.string(),
  description: z.string(),
  intro: z.string(),
  stories: z.array(z.object({ headline: z.string(), text: z.string() })),
  outro: z.string(),
});
export type PodcastScript = z.infer<typeof ScriptSchema>;

const SYSTEM = `You write the script of «${PODCAST_NAME}», the nightly Persian news podcast of «اخبار ایرلند به فارسی» (Ireland News Persian), for Iranians living in Ireland. It is read aloud by a text-to-speech voice, so it must sound like a warm, natural, professional Persian radio news bulletin.

CONTENT
- You get today's most important articles (already in Persian). Keep them in the given order.
- Only use facts that are in the articles. Do not add, guess or change facts.
- intro: greet («سلام، شب‌تون بخیر» style, friendly but professional), say this is «${PODCAST_NAME}» from «اخبار ایرلند به فارسی», and say the day and date of this episode clearly, with the weekday, the day, the month and the year, all in words (e.g. «امشب، پنجشنبه پنجم نوامبر دو هزار و بیست و شش»). Then read the headlines of tonight's stories in one or two short sentences.
- stories: for each article, "headline" is a short spoken headline (one sentence), "text" is 3–5 short sentences with the most important points in plain words: what happened, why it matters for people living in Ireland, who it affects, and what happens next. Explain anything a newcomer might not know in a few words. Never just repeat the headline. Smooth spoken transitions are welcome («و اما خبر بعدی...»).
- outro: a short sign-off. First say again which day this episode was for, with the weekday and the full date in words (e.g. «این بود «${PODCAST_NAME}» برای پنجشنبه، پنجم نوامبر دو هزار و بیست و شش.»). Then invite listeners to read the full stories on the website and in the Telegram channel «اخبار ایرلند به فارسی», say good night, ending with the show name as the sign-off, e.g. «... تا فردا شب، شب بخیر ایرلند!».
- Total length 350–550 Persian words (about 3 minutes).
- episode_title: «${PODCAST_NAME}» is NOT included; a short title naming the top story or two (max 10 words).
- description: 1–2 sentences for the podcast page listing the main topics.

WRITTEN FOR THE EAR (very important for the voice)
- Everything in Persian letters only. No English or Latin letters at all, no abbreviations, no parentheses, no hashtags, no emojis, no markdown. Write names the way they are pronounced, in Persian letters (e.g. «سایمون هریس»), and prefer a role instead of an unfamiliar name («وزیر دادگستری ایرلند»). Say «پلیس ایرلند» for Garda, «سازمان بهداشت ایرلند» for HSE, etc.
- Write numbers, money, percentages and dates as words: «سیصد یورو»، «چهار درصد»، «پنجم نوامبر».
- Short sentences (8–18 words), simple spoken Persian, correct ZWNJ. Use commas to mark natural pauses.`;

export async function writePodcastScript(
  articles: { title_fa: string; summary_fa: string; body_fa: string; category: string }[],
  dateFa: string,
): Promise<PodcastScript | null> {
  const input = articles
    .map((a, i) => `### ${i + 1}. ${a.title_fa}\nCategory: ${a.category}\nSummary: ${a.summary_fa}\n\n${a.body_fa.slice(0, 2500)}`)
    .join("\n\n");
  try {
    const res = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...(/opus|sonnet/.test(MODEL) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: "medium", format: betaZodOutputFormat(ScriptSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: `Date of this episode: ${dateFa}\n\n${input}` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    return res.parsed_output;
  } catch (e) {
    console.warn("podcast script failed:", String(e).slice(0, 300));
    return null;
  }
}

/** Plain text of the whole script (for the website and the database). */
export function scriptText(s: PodcastScript): string {
  return [s.intro, ...s.stories.map((x) => `${x.headline}\n${x.text}`), s.outro].join("\n\n");
}
