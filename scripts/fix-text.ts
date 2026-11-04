/**
 * One-off / occasional repair of Persian text in articles that are already saved.
 * DRY run by default: prints what would change. Set APPLY=true to save the changes.
 */
import { adminDb } from "./lib/db";
import { envBool } from "./lib/env";
import { fixPersian, MIXED_WORD } from "./lib/fa-fixes";
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
    for (const f of TEXT_FIELDS) {
      const v = r[f];
      if (typeof v !== "string") continue;
      const fixed = fixPersian(v);
      if (fixed !== v) update[f] = fixed;
    }
    if (r.social) {
      const social = Object.fromEntries(Object.entries(r.social).map(([k, v]) => [k, typeof v === "string" ? fixPersian(v) : v]));
      if (JSON.stringify(social) !== JSON.stringify(r.social)) update.social = social;
    }
    if (r.tags?.length) {
      const tags = r.tags.map(fixPersian);
      if (tags.join("|") !== r.tags.join("|")) update.tags = tags;
    }
    // Other Persian+Latin glued words that no rule covers yet, for a human to look at.
    const after = { ...r, ...update };
    for (const f of TEXT_FIELDS) {
      const v = after[f];
      if (typeof v === "string") for (const m of v.matchAll(MIXED_WORD)) leftovers.set(m[0], (leftovers.get(m[0]) ?? 0) + 1);
    }
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
