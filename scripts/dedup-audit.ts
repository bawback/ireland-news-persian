/**
 * Lists published articles of the last days that repeat an earlier article (read-only by
 * default). With DEDUP_APPLY=true the repeats are unpublished (status "rejected"; reversible).
 */
import { writeFileSync } from "node:fs";
import { adminDb } from "./lib/db";
import { envBool, envInt } from "./lib/env";
import { checkNovelty } from "./lib/ai";
import { refreshSite } from "./lib/revalidate";

async function main() {
  const db = adminDb();
  const days = envInt("DEDUP_DAYS", 3);
  const apply = envBool("DEDUP_APPLY", false);
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await db
    .from("articles")
    .select("id, slug, source_title, title_fa, summary_fa, category, published_at")
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  const kept: typeof rows = [];
  const dups: { a: (typeof rows)[number]; of: string; verdict: string }[] = [];
  for (let i = 0; i < rows.length; i += 12) {
    const batch = rows.slice(i, i + 12);
    const v = await checkNovelty(
      kept.map((a, index) => ({ index, source_title: a.source_title ?? "", title_fa: a.title_fa })),
      batch.map((a, index) => ({ index, title: a.source_title ?? a.title_fa, summary: (a.summary_fa ?? "").slice(0, 300) })),
    );
    if (!v) throw new Error("novelty check failed");
    for (const [j, a] of batch.entries()) {
      const r = v.get(j);
      if (r?.verdict === "duplicate" || (r?.verdict === "update" && a.category === "entertainment")) {
        dups.push({ a, of: r.same_as >= 0 ? kept[r.same_as]?.title_fa ?? "?" : "(same batch)", verdict: r.verdict });
      } else kept.push(a);
    }
  }
  const lines = [`# Repeated articles, last ${days} days: ${dups.length} of ${rows.length}`, ""];
  for (const d of dups) lines.push(`- ${d.a.published_at?.slice(0, 16)} ${d.a.title_fa}\n  repeats: ${d.of}\n  /news/${d.a.slug}`);
  const report = lines.join("\n");
  console.log(report);
  writeFileSync("dedup-report.md", report);
  if (apply && dups.length) {
    for (const d of dups) await db.from("articles").update({ status: "rejected", notes_for_editor: `Unpublished as a repeat of: ${d.of}` }).eq("id", d.a.id);
    await refreshSite();
    console.log(`Unpublished ${dups.length} repeats.`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
