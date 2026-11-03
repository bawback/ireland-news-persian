import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { CLASSIFIER_MODEL } from "./ai";

const client = new Anthropic();

/** Size used on the site, for Google Discover / News (at least 1200px wide) and Telegram previews. */
export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 675;
export const AI_IMAGE_CREDIT = "تصویر تزئینی؛ ساخته‌شده با هوش مصنوعی";

const ImagePlanSchema = z.object({
  prompt: z.string(),
  alt_fa: z.string(),
});
export type ImagePlan = z.infer<typeof ImagePlanSchema>;

const PLANNER_SYSTEM = `You are the photo editor of «اخبار ایرلند به فارسی», a Persian-language news site about Ireland and Northern Ireland.
For each article, design ONE illustrative cover image that fits the story and makes readers want to click, while staying honest.

prompt (English, for the FLUX image model, 40-80 words):
- Editorial news-photography style: realistic, natural light, shallow depth of field, strong simple composition, 16:9 landscape, one clear subject.
- Show the THEME or SETTING of the story (a place, object, activity, symbol), e.g. a rent sign on a Dublin terraced house, a hospital corridor, a hurling ball on grass, a passport and residence card on a desk, an Irish country road in rain.
- Use Irish visual cues when they help (Dublin Georgian doors, Irish countryside, Belfast streets, green post boxes, Garda car seen from behind) but keep them generic.
- NEVER depict real, named or recognisable people, politicians, celebrities or athletes, and no close-up faces. People, if any, are anonymous: from behind, silhouettes, hands, or far away and out of focus.
- NEVER recreate the actual event as if it were a real photo of it (no specific crash, fire, crime scene, protest or court moment). Prefer symbolic or atmospheric scenes.
- No text, letters, numbers, signs with words, logos, brand names or flags with emblems in the image.
- Nothing graphic: no blood, injuries, weapons pointed at anyone, bodies or distress. For crime, death or court stories use calm symbolic images (courthouse columns, blue light in the distance at dusk, a candle).

alt_fa (Persian, 8-20 words): a plain, accurate description of what the image actually shows, naturally including the story's main topic keyword. Do not start with «تصویر» or «عکس». Correct ZWNJ.`;

export async function planImage(a: { title_fa: string; summary_fa: string; category: string; tags: string[] }): Promise<ImagePlan | null> {
  try {
    const res = await client.messages.parse({
      model: CLASSIFIER_MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: zodOutputFormat(ImagePlanSchema) },
      system: PLANNER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Category: ${a.category}\nTags: ${a.tags.join(", ")}\nHeadline: ${a.title_fa}\nSummary: ${a.summary_fa}`,
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return null;
    return res.parsed_output;
  } catch (e) {
    console.warn("  image planning failed:", String(e).slice(0, 300));
    return null;
  }
}

type FalResult = { images?: { url: string }[]; has_nsfw_concepts?: boolean[] };

/** Generates the picture with FLUX.1 [schnell] on fal.ai and returns it as an optimised WebP. */
export async function renderImage(prompt: string, falKey: string): Promise<Buffer | null> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1280, height: 720 },
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "jpeg",
    }),
    signal: AbortSignal.timeout(90_000),
  }).catch((e) => e as Error);
  if (!(res instanceof Response)) {
    console.warn("  image service unreachable:", String(res).slice(0, 200));
    return null;
  }
  if (!res.ok) {
    console.warn(`  image service error ${res.status}:`, (await res.text()).slice(0, 300));
    return null;
  }
  const json = (await res.json()) as FalResult;
  if (json.has_nsfw_concepts?.[0]) {
    console.warn("  image blocked by safety checker");
    return null;
  }
  const url = json.images?.[0]?.url;
  if (!url) return null;
  const img = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!img.ok) return null;
  const raw = Buffer.from(await img.arrayBuffer());
  return sharp(raw)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
}
