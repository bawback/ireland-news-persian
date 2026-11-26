import { isolateForSocial } from "../../src/lib/bidi";
import { NI_BADGE, NI_NAME, addNiHashtag, stripLabel } from "../../src/lib/region";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The HTML text of a news post in the channel: bold headline, body, link to the full story.
 * A Northern Ireland story (ni) starts with a «📍 ایرلند شمالی» line and gets the #ایرلند_شمالی hashtag.
 */
export function telegramNewsText(body: string, link: string, opts: { ni?: boolean } = {}): string {
  const plain = opts.ni ? addNiHashtag(stripLabel(body)) : body;
  const lines = isolateForSocial(plain).split("\n");
  const text = [`<b>${escapeHtml(lines[0])}</b>`, ...lines.slice(1).map(escapeHtml)].join("\n");
  const label = opts.ni ? `${NI_BADGE.replace(NI_NAME, `<b>${NI_NAME}</b>`)}\n` : "";
  return `${label}${text}\n\n‏🔗 <a href="${link}">متن کامل خبر</a>`;
}
