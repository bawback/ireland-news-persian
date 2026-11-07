/**
 * Keeps storage small: pictures of articles older than IMAGE_KEEP_DAYS (default 30) are deleted
 * from storage and removed from the article. Only our own pictures (news-images bucket) are
 * touched; podcasts and guides are not.
 */
import { adminDb } from "./lib/db";
import { envInt } from "./lib/env";
import { refreshSite } from "./lib/revalidate";

const BUCKET = "news-images";

async function main() {
  const days = envInt("IMAGE_KEEP_DAYS", 30);
  const db = adminDb();
  const before = new Date(Date.now() - days * 86400_000).toISOString();
  const { data: rows, error } = await db
    .from("articles")
    .select("id, image_url")
    .not("image_url", "is", null)
    .lt("created_at", before)
    .limit(300);
  if (error) throw error;
  let done = 0;
  for (const a of rows ?? []) {
    if (!String(a.image_url).includes(`/object/public/${BUCKET}/${a.id}/`)) continue; // not our upload
    const { data: files } = await db.storage.from(BUCKET).list(a.id);
    const paths = (files ?? []).map((f) => `${a.id}/${f.name}`);
    if (paths.length) {
      const { error: rmErr } = await db.storage.from(BUCKET).remove(paths);
      if (rmErr) {
        console.warn(`  ${a.id}: ${rmErr.message}`);
        continue;
      }
    }
    await db.from("articles").update({ image_url: null, image_credit: null, image_alt: null }).eq("id", a.id);
    done++;
  }
  console.log(`Removed pictures of ${done} articles older than ${days} days.`);
  if (done) await refreshSite();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
