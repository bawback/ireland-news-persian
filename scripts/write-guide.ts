/**
 * Daily SEO guide: takes the next topic from scripts/seo-topics.ts, researches it on official
 * Irish websites (Claude web search + fetch), writes a complete Persian guide in the owner's
 * style and saves it to src/content/guides/auto.json. The workflow then commits the file,
 * which redeploys the site with the new guide at /guides/<slug>.
 * GUIDE_TOPIC=<id> picks a specific topic. DRY_RUN=true prints instead of saving.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { readFileSync, writeFileSync } from "node:fs";
import { BABAK_VOICE } from "./lib/ai";
import { fixPersian } from "./lib/fa-fixes";
import { envBool } from "./lib/env";
import { SEO_TOPICS, type SeoTopic } from "./seo-topics";

const client = new Anthropic();
const MODEL = process.env.GUIDE_MODEL ?? "claude-sonnet-5-5";
const FILE = "src/content/guides/auto.json";
const STATIC_GUIDES = [
  { slug: "pps-number", title: "گرفتن PPS در ایرلند" },
  { slug: "irp-renewal", title: "تمدید IRP" },
];

/** Reliable sources only: Irish government, public bodies and official information services. */
const DOMAINS = [
  "citizensinformation.ie", "irishimmigration.ie", "gov.ie", "enterprise.gov.ie", "revenue.ie", "hse.ie",
  "ndls.ie", "rsa.ie", "rtb.ie", "mywelfare.ie", "ipo.gov.ie", "ipat.ie", "dfa.ie", "ireland.ie", "cso.ie",
  "workplacerelations.ie", "qqi.ie", "hea.ie", "educationinireland.com", "nmbi.ie", "medicalcouncil.ie",
  "cro.ie", "centralbank.ie", "transportforireland.ie", "eircode.ie", "tusla.ie", "pobal.ie", "ccpc.ie",
  "localenterprise.ie", "comreg.ie", "ihrec.ie", "oireachtas.ie", "irishstatutebook.ie",
];

type Saved = {
  topic: string;
  slug: string; title: string; seoTitle: string; description: string; keywords: string[];
  published: string; updated: string; summary: string[]; body: string; faqTitle?: string;
  faqs: { q: string; a: string }[]; sources: { name: string; url: string }[];
};

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin" }).format(new Date());

// ------------------------------------------------------------------ 1) research

async function research(t: SeoTopic): Promise<{ notes: string; urls: Set<string> }> {
  const tools = [
    { type: "web_search_20260209", name: "web_search", max_uses: 8, allowed_domains: DOMAINS },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 10, allowed_domains: DOMAINS },
  ] as unknown as Anthropic.Messages.ToolUnion[];
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `Research this topic for a complete, accurate, up-to-date guide for Iranians living in Ireland or planning to move there.

Topic (Persian search phrase): ${t.keyword}
Related searches to cover: ${t.variants.join("، ")}
What the guide should explain: ${t.angle}
Today's date: ${today()}

Use only official Irish sources (search and fetch the actual pages; prefer citizensinformation.ie, irishimmigration.ie, gov.ie and the responsible public body). Read the pages, don't rely on memory.

Return research notes in English:
- Every fact (rules, steps, documents, fees, amounts, thresholds, deadlines, processing times, dates of changes) with the URL it came from in square brackets.
- Say which figures are for which year, and note anything that changed recently or is uncertain.
- Points that matter specifically for Iranian citizens (visa-required nationality, no Irish embassy in Iran, etc.) if official sources mention them.
- End with "SOURCES:" and one line per page you actually used: page title | URL.`,
    },
  ];
  const urls = new Set<string>();
  let notes = "";
  for (let i = 0; i < 6; i++) {
    const res = await client.messages.create({ model: MODEL, max_tokens: 16000, tools, messages });
    for (const m of JSON.stringify(res.content).matchAll(/https?:\/\/[^"\\\s)]+/g)) urls.add(m[0].replace(/[.,]+$/, ""));
    notes += res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === "text").map((b) => b.text).join("\n");
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    break;
  }
  return { notes, urls };
}

// ------------------------------------------------------------------ 2) write

const GuideSchema = z.object({
  title: z.string(),
  seoTitle: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  summary: z.array(z.string()),
  body: z.string(),
  faqs: z.array(z.object({ q: z.string(), a: z.string() })),
  sources: z.array(z.object({ name: z.string(), url: z.string() })),
});

function writerSystem(others: { slug: string; title: string }[]) {
  return `You write evergreen Persian guides for «اخبار ایرلند به فارسی» (irelandnewspersian.com), for Iranians who live in Ireland or want to move there. The goal: the most useful, accurate and complete Persian page on the web for the given search phrase, so it ranks first on Google.

ACCURACY (most important)
- Use ONLY facts from the research notes. Never add numbers, fees, rules or dates from memory. If something is unclear, say so and point to the official page.
- Mention the year for every amount/threshold («در سال ۲۰۲۶»). Rules change: add a short line that the guide was checked on the date given, and that readers should confirm on the official page before applying.
- No legal advice tone; explain what official sources say. Never promise outcomes.

SEO
- title (H1): contains the main search phrase exactly, natural Persian, may include the year, ≤ 75 characters.
- seoTitle: ≤ 60 characters, starts with or contains the main search phrase.
- description: 140–160 characters, contains the main phrase, says what the reader will learn.
- keywords: 6–10 items: the main phrase, the related searches, and common spelling variants (Persian and English, e.g. «استمپ ۴»، «استمپ 4»، «Stamp 4»).
- First paragraph contains the main phrase; use the related phrases naturally in headings and text (no keyword stuffing).
- Body length: 1500–3000 Persian words, covering everything a reader needs, step by step.

FORMAT (body)
- Paragraphs separated by a blank line. Sections: "## Heading {#english-id}" (short lowercase ASCII id with hyphens). Subsections: "### Heading".
- Lists with "- " or "1. ". Bold with **…**. A quote/notice line starts with "> ".
- Links only as [Persian text](https://…), only to URLs from the research notes, and to our own guides: ${others.map((o) => `[${o.title}](/guides/${o.slug})`).join("، ") || "(none yet)"} — link to ours only where truly relevant (use the relative path, e.g. (/guides/pps-number)).
- Do NOT include the FAQ or the sources in the body; they are separate fields.
- summary: 4–6 short bullet sentences (the key takeaways), **bold** allowed.
- faqs: 6–8 real questions people search (include the related phrases), each answer 1–3 sentences, from the notes.
- sources: the official pages actually used (name in English as on the page, exact URL from the notes).
${BABAK_VOICE}`;
}

async function writeGuide(t: SeoTopic, notes: string, others: { slug: string; title: string }[]) {
  // Long Persian output: stream it (required for long requests) and validate the JSON ourselves.
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    output_config: { effort: "medium", format: betaZodOutputFormat(GuideSchema) },
    system: writerSystem(others),
    messages: [
      {
        role: "user",
        content: `Main search phrase: ${t.keyword}\nRelated searches: ${t.variants.join("، ")}\nWhat to explain: ${t.angle}\nChecked on: ${today()}\n\n<research_notes>\n${notes}\n</research_notes>`,
      },
    ],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason !== "end_turn") throw new Error(`writer stopped: ${msg.stop_reason}`);
  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  return GuideSchema.parse(JSON.parse(text));
}

// ------------------------------------------------------------------ main

async function main() {
  const saved: Saved[] = JSON.parse(readFileSync(FILE, "utf8"));
  const done = new Set(saved.map((g) => g.topic));
  const wanted = process.env.GUIDE_TOPIC?.trim();
  const topic = wanted ? SEO_TOPICS.find((t) => t.id === wanted) : SEO_TOPICS.find((t) => !done.has(t.id));
  if (!topic) {
    console.log("No topic left. Add more to scripts/seo-topics.ts.");
    return;
  }
  console.log(`Topic: ${topic.keyword} (${topic.id})`);

  const { notes, urls } = await research(topic);
  console.log(`Research: ${notes.length} chars, ${urls.size} URLs seen`);
  if (notes.length < 1500) throw new Error("Research too thin; not publishing.");

  const others = [...STATIC_GUIDES, ...saved.filter((g) => g.topic !== topic.id).map((g) => ({ slug: g.slug, title: g.title }))];
  const g = await writeGuide(topic, notes, others);

  // Keep only sources that research really visited; drop links in the body that it did not see.
  const seen = (u: string) => [...urls].some((x) => x.replace(/\/$/, "") === u.replace(/\/$/, ""));
  const sources = g.sources.filter((s) => /^https:\/\//.test(s.url) && seen(s.url));
  if (sources.length < 2) throw new Error(`Only ${sources.length} verified sources; not publishing.`);
  const body = fixPersian(g.body).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, text, url) => (seen(url) ? m : text));
  const words = body.split(/\s+/).length;
  if (words < 1000) throw new Error(`Guide too short (${words} words); not publishing.`);

  const slug = topic.id;
  const prev = saved.find((x) => x.topic === topic.id);
  const guide: Saved = {
    topic: topic.id,
    slug,
    title: fixPersian(g.title),
    seoTitle: fixPersian(g.seoTitle),
    description: fixPersian(g.description),
    keywords: g.keywords.map(fixPersian),
    published: prev?.published ?? today(),
    updated: today(),
    summary: g.summary.map(fixPersian),
    body,
    faqs: g.faqs.map((f) => ({ q: fixPersian(f.q), a: fixPersian(f.a) })),
    sources,
  };
  console.log(`\n# ${guide.title}\n${guide.description}\n${words} words, ${guide.faqs.length} FAQs, ${sources.length} sources\n`);
  if (envBool("DRY_RUN", false)) {
    console.log(guide.body);
    return;
  }
  const next = [guide, ...saved.filter((x) => x.topic !== topic.id)];
  writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n");
  writeFileSync("guide-result.txt", `${guide.slug}\n${guide.title}\n${guide.description}\n`);
  console.log(`✓ saved /guides/${slug}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
