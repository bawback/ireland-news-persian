/**
 * Gives every recently published article without a picture an AI-made illustrative cover image.
 * Runs after ingest and before the Telegram step, so Telegram previews show the picture.
 * Needs FAL_KEY (fal.ai), ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Articles that already have a picture (for example one added in the admin panel) are never touched.
 */
import { adminDb } from "./lib/db";
import { envInt, envOptional } from "./lib/env";
import { AI_IMAGE_CREDIT, ImageServiceUnavailable, planImage, renderImage } from "./lib/images";
import { refreshSite } from "./lib/revalidate";
import { fixPersian } from "./lib/fa-fixes";

const BUCKET = "news-images";

async function main() {
  const falKey = envOptional("FAL_KEY");
  if (!falKey) {
    console.log("FAL_KEY is not set yet; skipping images.");
    return;
  }
  const limit = envInt("IMAGES_PER_RUN", 8);
  const days = envInt("IMAGE_BACKFILL_DAYS", 7);
  const db = adminDb();
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();
  const { data: articles, error } = await db
    .from("articles")
    .select("id, slug, title_fa, summary_fa, category, tags")
    .eq("status", "published")
    .is("image_url", null)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  console.log(`${articles?.length ?? 0} articles need a picture`);

  let added = 0;
  for (const a of articles ?? []) {
    console.log(`→ ${a.title_fa}`);
    const plan = await planImage(a);
    if (!plan) continue;
    let webp: Buffer | null;
    try {
      webp = await renderImage(plan.prompt, falKey);
    } catch (e) {
      if (!(e instanceof ImageServiceUnavailable)) throw e;
      console.warn("Stopping: the fal.ai account needs a valid key or more credit.");
      break;
    }
    if (!webp) continue;

    // SEO-friendly file name from the English slug, inside the article's own folder
    // (so the admin panel's "remove picture" also cleans it up).
    const name = a.slug.replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 80) || "news";
    const path = `${a.id}/${name}.webp`;
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, webp, { contentType: "image/webp", cacheControl: "31536000", upsert: true });
    if (upErr) {
      console.warn("  upload failed:", upErr.message);
      continue;
    }
    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const update = { image_url: url, image_credit: AI_IMAGE_CREDIT, image_alt: fixPersian(plan.alt_fa.trim()) };
    let { error: updErr } = await db.from("articles").update(update).eq("id", a.id);
    if (updErr && /image_alt/.test(updErr.message)) {
      // The image_alt column has not been added yet: save without it.
      const { image_alt: _skip, ...rest } = update;
      void _skip;
      ({ error: updErr } = await db.from("articles").update(rest).eq("id", a.id));
    }
    if (updErr) {
      console.warn("  save failed:", updErr.message);
      continue;
    }
    added++;
    console.log(`  ✓ ${url}`);
  }

  if (added) await refreshSite();
  console.log(`\nDone: ${added} pictures added.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
