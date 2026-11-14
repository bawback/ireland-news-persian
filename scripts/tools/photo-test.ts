/** Dry run: which recent articles would get a free Commons photo, and which one. Saves nothing. */
import { adminDb } from "../lib/db";
import { findFreePhoto } from "../lib/free-photos";

async function main() {
  const { data } = await adminDb()
    .from("articles")
    .select("title_fa, summary_fa, category, tags, source_title")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(Number(process.env.COUNT ?? 12));
  let found = 0;
  for (const a of data ?? []) {
    console.log(`\n→ ${a.source_title}`);
    const p = await findFreePhoto(a);
    if (p) {
      found++;
      console.log(`  RESULT ${p.source}\n  credit: ${p.credit}\n  alt: ${p.alt_fa}`);
    }
  }
  console.log(`\n${found} of ${data?.length ?? 0} would get a real photo.`);
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
