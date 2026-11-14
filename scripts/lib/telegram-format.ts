import { isolateForSocial } from "../../src/lib/bidi";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The HTML text of a news post in the channel: bold headline, body, link to the full story. */
export function telegramNewsText(body: string, link: string): string {
  const lines = isolateForSocial(body).split("\n");
  const text = [`<b>${escapeHtml(lines[0])}</b>`, ...lines.slice(1).map(escapeHtml)].join("\n");
  return `${text}\n\n‏🔗 <a href="${link}">متن کامل خبر</a>`;
}
