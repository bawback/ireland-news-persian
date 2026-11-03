"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/admin/auth";
import { adminDb, IMAGE_BUCKET } from "@/lib/admin/db";
import { CATEGORIES } from "@/lib/categories";

const STATUSES = ["published", "pending_review", "rejected"];

function text(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function int(form: FormData, name: string, min: number, max: number, fallback: number): number {
  const n = Number(form.get(name));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/** Refresh every cached page that shows articles, so edits appear on the site right away. */
function refreshSite() {
  updateTag("articles");
}

// ---------------------------------------------------------------- login

export async function login(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  if (!checkPassword(String(form.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 1000)); // slows down password guessing
    return { error: "رمز اشتباه است." };
  }
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- images

async function uploadImage(articleId: string, file: File): Promise<string> {
  // Only plain photo formats: no SVG (it can carry scripts) and nothing over 5 MB.
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("فقط عکس JPG، PNG یا WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("عکس بزرگ‌تر از ۵ مگابایت است.");
  const db = adminDb();
  // Create the public bucket the first time it is needed.
  const { error: bucketErr } = await db.storage.createBucket(IMAGE_BUCKET, { public: true });
  if (bucketErr && !/exist/i.test(bucketErr.message)) throw new Error(bucketErr.message);

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${articleId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function removeImages(articleId: string) {
  const db = adminDb();
  const { data } = await db.storage.from(IMAGE_BUCKET).list(articleId);
  if (data?.length) await db.storage.from(IMAGE_BUCKET).remove(data.map((f) => `${articleId}/${f.name}`));
}

// ---------------------------------------------------------------- edit / delete

export async function saveArticle(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const category = text(form, "category");
  const status = text(form, "status");

  const update: Record<string, unknown> = {
    title_fa: text(form, "title_fa"),
    summary_fa: text(form, "summary_fa"),
    body_fa: String(form.get("body_fa") ?? "").replace(/\r\n/g, "\n").trim(),
    category: CATEGORIES.some((c) => c.slug === category) ? category : "ireland",
    tags: text(form, "tags")
      .split(/[,،]/)
      .map((t) => t.trim())
      .filter(Boolean),
    status: STATUSES.includes(status) ? status : "pending_review",
    importance: int(form, "importance", 1, 5, 3),
    immigrant_relevance: int(form, "immigrant_relevance", 0, 3, 0),
    image_credit: text(form, "image_credit") || null,
    image_alt: text(form, "image_alt") || null,
    image_url: /^https:\/\//.test(text(form, "image_url")) ? text(form, "image_url") : null,
  };
  if (!update.title_fa || !update.body_fa) redirect(`/admin/edit?id=${id}&error=empty`);

  const file = form.get("image_file");
  if (form.get("remove_image") === "on") {
    await removeImages(id);
    update.image_url = null;
    update.image_credit = null;
    update.image_alt = null;
  } else if (file instanceof File && file.size > 0) {
    try {
      update.image_url = await uploadImage(id, file);
    } catch (e) {
      console.error("image upload failed:", e);
      redirect(`/admin/edit?id=${id}&error=image`);
    }
  }

  let { error } = await adminDb().from("articles").update(update).eq("id", id);
  if (error && /image_alt/.test(error.message)) {
    // The image_alt column has not been added in Supabase yet: save everything else.
    delete update.image_alt;
    ({ error } = await adminDb().from("articles").update(update).eq("id", id));
  }
  if (error) {
    console.error("save failed:", error.message);
    redirect(`/admin/edit?id=${id}&error=save`);
  }
  refreshSite();
  redirect(`/admin/edit?id=${id}&saved=1`);
}

export async function deleteArticle(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  await removeImages(id);
  const { error } = await adminDb().from("articles").delete().eq("id", id);
  if (error) redirect(`/admin/edit?id=${id}&error=delete`);
  refreshSite();
  redirect("/admin?deleted=1");
}

export async function setStatus(form: FormData) {
  await requireAdmin();
  const id = text(form, "id");
  const status = text(form, "status");
  if (!STATUSES.includes(status)) return;
  await adminDb().from("articles").update({ status }).eq("id", id);
  refreshSite();
}

// ---------------------------------------------------------------- merge

/**
 * Merges several articles about the same story into one:
 * the main article keeps its title and gets the other texts appended (to trim by hand),
 * plus their tags and an image if it has none. The others are hidden, not deleted.
 */
export async function mergeArticles(form: FormData) {
  await requireAdmin();
  const mainId = text(form, "main");
  const ids = form.getAll("ids").map(String).filter(Boolean);
  const others = ids.filter((x) => x !== mainId);
  if (!mainId || !others.length) redirect("/admin?error=merge");

  const db = adminDb();
  const { data: rows, error } = await db
    .from("articles")
    .select("id, title_fa, summary_fa, body_fa, tags, image_url, image_credit, source_name, source_url, importance, immigrant_relevance")
    .in("id", [mainId, ...others]);
  if (error || !rows) redirect("/admin?error=merge");

  const main = rows.find((r) => r.id === mainId);
  const rest = rows.filter((r) => r.id !== mainId);
  if (!main) redirect("/admin?error=merge");

  let body = main.body_fa as string;
  for (const r of rest) {
    body += `\n\n## گزارش تکمیلی\n\n${r.body_fa}\n\n> منبع: ${r.source_name}`;
  }
  const tags = [...new Set([...(main.tags ?? []), ...rest.flatMap((r) => r.tags ?? [])])];
  const withImage = rest.find((r) => r.image_url);

  const { error: upErr } = await db
    .from("articles")
    .update({
      body_fa: body,
      tags,
      importance: Math.max(main.importance, ...rest.map((r) => r.importance)),
      immigrant_relevance: Math.max(main.immigrant_relevance, ...rest.map((r) => r.immigrant_relevance)),
      ...(!main.image_url && withImage ? { image_url: withImage.image_url, image_credit: withImage.image_credit } : {}),
    })
    .eq("id", mainId);
  if (upErr) redirect("/admin?error=merge");

  await db.from("articles").update({ status: "rejected" }).in("id", others);
  refreshSite();
  redirect(`/admin/edit?id=${mainId}&merged=${others.length}`);
}
