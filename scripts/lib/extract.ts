import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/**
 * Downloads an article page and extracts its main text.
 * Returns null when the page cannot be read (paywall, blocked, etc.).
 */
export async function extractArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; IrelandNewsPersianBot/1.0)" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    const text = article?.textContent?.replace(/\n{3,}/g, "\n\n").trim();
    return text && text.length > 200 ? text.slice(0, 30_000) : null;
  } catch {
    return null;
  }
}
