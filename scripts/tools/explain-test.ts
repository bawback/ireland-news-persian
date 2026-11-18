/** Dry run: re-runs the Telegram term explainer on the latest posts and prints old vs new 💡 lines. */
import { adminDb } from "../lib/db";
import { explainTelegramTerms } from "../lib/ai";

async function main() {
  const n = Number(process.env.LIMIT || 15);
  const { data, error } = await adminDb()
    .from("articles")
    .select("title_fa, social")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(n);
  if (error) throw error;
  for (const r of data ?? []) {
    const tg: string = r.social?.telegram ?? "";
    const old = tg.split("\n").filter((l) => l.trim().startsWith("💡"));
    const fresh = (await explainTelegramTerms(tg)).split("\n").filter((l) => l.trim().startsWith("💡"));
    console.log(`\n■ ${r.title_fa}\n  before: ${old.join(" | ") || "—"}\n  after:  ${fresh.join(" | ") || "—"}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
