/**
 * Replaces AI pictures with real free-licence photos (Wikimedia Commons) where a good one exists,
 * for articles published in the last PHOTO_DAYS days. Pictures added by hand in the admin panel
 * are never touched; articles without a good photo keep their AI picture.
 */
import { adminDb } from "../lib/db";
import { envInt } from "../lib/env";
import { AI_IMAGE_CREDIT } from "../lib/images";
import { findFreePhoto } from "../lib/free-photos";
import { fixPersian } from "../lib/fa-fixes";
import { refreshSite } from "../lib/revalidate";

const BUCKET = "news-images";

async function main() {
  const db = adminDb();
  const since = new Date(Date.now() - envInt("PHOTO_DAYS", 2) * 86400_000).toISOString();
  const { data, error } = await db
    .from("articles")
    .select("id, slug, title_fa, summary_fa, category, tags, source_title, image_url, image_credit")
    .eq("status", "published")
    .gte("published_at", since)
    .order("published_at", { ascending: false });
  if (error) throw error;
  const todo = (data ?? []).filter((a) => !a.image_url || a.image_credit === AI_IMAGE_CREDIT);
  console.log(`${todo.length} articles with an AI picture or none`);
  let replaced = 0;
  for (const a of todo) {
    console.log(`→ ${a.source_title}`);
    const photo = await findFreePhoto(a);
    if (!photo) continue;
    const name = a.slug.replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 70) || "news";
    const path = `${a.id}/${name}-photo.webp`;
    const { error: upErr } = await db.storage.from(BUCKET).upload(path, photo.webp, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (upErr) {
      console.warn("  upload failed:", upErr.message);
      continue;
    }
    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error: updErr } = await db
      .from("articles")
      .update({ image_url: url, image_credit: photo.credit, image_alt: fixPersian(photo.alt_fa.trim()) })
      .eq("id", a.id);
    if (updErr) {
      console.warn("  save failed:", updErr.message);
      continue;
    }
    // Remove the old AI picture file from the article's folder.
    const { data: files } = await db.storage.from(BUCKET).list(a.id);
    const old = (files ?? []).map((f) => `${a.id}/${f.name}`).filter((p) => p !== path);
    if (old.length) await db.storage.from(BUCKET).remove(old);
    replaced++;
    console.log(`  REPLACED ${a.slug}`);
  }
  console.log(`\nDone: ${replaced} of ${todo.length} now have a real photo.`);
  if (replaced) await refreshSite();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
