/**
 * Small, safe corrections applied to every Persian text the AI writes
 * (and used once to repair articles that were already published).
 */

// Fixed Persian spellings for place names the model sometimes gets wrong.
// Each pattern also catches Persian letters glued to the English spelling, e.g. «دوblin».
const NAME_FIXES: [RegExp, string][] = [
  [/[\u0600-\u06FF][\u0600-\u06FF\u200c]*[Dd]?u?blin(?![A-Za-z])/g, "دابلین"],
  [/(?<![\u0600-\u06FF])(?:دوبلین|دبلین|دوب\u200cلین)/g, "دابلین"],
  // The model sometimes slips into Cyrillic letters, e.g. «دублин».
  [/[\u0600-\u06FF\u200c]*[Дд]?у?блин/g, "دابلین"],
  [/گар[дd]а/g, "گاردا"],
  [/بل[\u0621-\u06D3]*f?ast(?![A-Za-z])/g, "بلفاست"],
  [/[\u0621-\u06D3]+(?:anagh|managh)(?![A-Za-z])/g, "فرمانا"],
];

/**
 * A word where Persian letters are glued directly to Latin letters, e.g. «بلفast» or «کالیnan».
 * The model sometimes stops transliterating a name halfway. Punctuation such as «HSE،» is not counted.
 */
export const MIXED_WORD =
  /[\u0621-\u06D3\u200c]*[\u0621-\u06D3][\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]+[\u0621-\u06D3\u200c]*|[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]+[\u0621-\u06D3][\u0621-\u06D3\u200c]*|[\p{Script=Cyrillic}\p{Script=Greek}]+/gu;

export function findMixedWords(...texts: string[]): string[] {
  const found = new Set<string>();
  for (const t of texts) if (t) for (const m of t.matchAll(MIXED_WORD)) found.add(m[0]);
  return [...found];
}

/** Replaces each broken word everywhere in the text. */
export function applyWordFixes(text: string, fixes: Map<string, string>): string {
  if (!text || !fixes.size) return text;
  let out = text;
  for (const [broken, fixed] of fixes) out = out.split(broken).join(fixed);
  return out;
}

/**
 * Applies the fixes to Persian text. English runs that are a full word "Dublin"
 * inside parentheses, e.g. «دابلین (Dublin)», are kept: they are the original name on first mention.
 */
export function fixPersian(text: string): string {
  if (!text) return text;
  // Protect "(Dublin ...)" written on purpose after the Persian name.
  const kept: string[] = [];
  let out = text.replace(/\((?:[^()]*\b)?Dublin\b[^()]*\)/g, (m) => {
    kept.push(m);
    return `\u0000${kept.length - 1}\u0000`;
  });
  for (const [re, to] of NAME_FIXES) out = out.replace(re, to);
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
}
