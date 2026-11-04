/**
 * One-off / occasional repair of Persian text in articles that are already saved.
 * DRY run by default: prints what would change. Set APPLY=true to save the changes.
 */
import { adminDb } from "./lib/db";
import { envBool } from "./lib/env";
import { applyWordFixes, findMixedWords, fixPersian } from "./lib/fa-fixes";
import { repairMixedWords } from "./lib/ai";
import { refreshSite } from "./lib/revalidate";

type Row = Record<string, unknown> & { id: string; slug: string; social: Record<string, string> | null; tags: string[] | null };
const TEXT_FIELDS = ["title_fa", "summary_fa", "body_fa", "image_alt"] as const;

async function main() {
  const apply = envBool("APPLY", false);
  const db = adminDb();
  const rows: Row[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from("articles").select("*").order("created_at").range(from, from + 499);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 500) break;
  }
  console.log(`${rows.length} articles checked (${apply ? "APPLY" : "dry run"})`);

  const leftovers = new Map<string, number>();
  let changedCount = 0;
  for (const r of rows) {
    const update: Record<string, unknown> = {};
    // 1) fixed rules (Dublin → دابلین ...)
    const texts: Record<string, string> = {};
    for (const f of TEXT_FIELDS) if (typeof r[f] === "string") texts[f] = fixPersian(r[f] as string);
    const social = Object.fromEntries(Object.entries(r.social ?? {}).map(([k, v]) => [k, typeof v === "string" ? fixPersian(v) : v]));
    let tags = (r.tags ?? []).map(fixPersian);
    // 2) AI repair of other half-Persian, half-English words
    const all = [...Object.values(texts), ...Object.values(social).filter((v): v is string => typeof v === "string"), ...tags];
    if (findMixedWords(...all).length) {
      const fixes = await repairMixedWords(all);
      if (fixes.size) console.log(`  ${r.slug}:`, [...fixes].map(([b, f]) => `${b}→${f}`).join("  "));
      for (const f of Object.keys(texts)) texts[f] = applyWordFixes(texts[f], fixes);
      for (const k of Object.keys(social)) if (typeof social[k] === "string") social[k] = applyWordFixes(social[k], fixes);
      tags = tags.map((t) => applyWordFixes(t, fixes));
    }
    for (const f of Object.keys(texts)) if (texts[f] !== r[f]) update[f] = texts[f];
    if (r.social && JSON.stringify(social) !== JSON.stringify(r.social)) update.social = social;
    if (r.tags && tags.join("|") !== r.tags.join("|")) update.tags = tags;
    // Anything still left, for a human to look at.
    for (const w of findMixedWords(...Object.values(texts))) leftovers.set(w, (leftovers.get(w) ?? 0) + 1);
    if (!Object.keys(update).length) continue;
    changedCount++;
    console.log(`• ${r.slug}: ${Object.keys(update).join(", ")}`);
    if (apply) {
      const { error } = await db.from("articles").update(update).eq("id", r.id);
      if (error) console.warn("  save failed:", error.message);
    }
  }
  console.log(`\n${changedCount} articles ${apply ? "fixed" : "would be fixed"}.`);
  if (leftovers.size) {
    console.log("Other glued Persian+English words still present:");
    for (const [w, n] of [...leftovers].sort((a, b) => b[1] - a[1]).slice(0, 50)) console.log(`  ${n}× ${w}`);
  }
  if (apply && changedCount) await refreshSite();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
