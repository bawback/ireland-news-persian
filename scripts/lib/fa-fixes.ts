/**
 * Small, safe corrections applied to every Persian text the AI writes
 * (and used once to repair articles that were already published).
 */

// Fixed Persian spellings for place names the model sometimes gets wrong.
// Each pattern also catches Persian letters glued to the English spelling, e.g. «دوblin».
const NAME_FIXES: [RegExp, string][] = [
  [/[\u0600-\u06FF][\u0600-\u06FF\u200c]*[Dd]?u?blin(?![A-Za-z])/g, "دابلین"],
  [/(?<![\u0600-\u06FF])(?:دوبلین|دبلین|دوب\u200cلین)/g, "دابلین"],
];

/** Persian letters stuck directly to Latin letters (a sign of a broken word). Used for reporting. */
export const MIXED_WORD = /[؀-ۿ]+[A-Za-z]+[؀-ۿ]*|[A-Za-z]+[؀-ۿ]+/g;

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
