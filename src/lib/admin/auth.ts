import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

const COOKIE = "inp_admin";
const MAX_AGE = 30 * 24 * 3600; // 30 days

/** The admin panel works only when both values are set on the server (Vercel env vars). */
export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// The signing key depends on the password, so changing ADMIN_PASSWORD logs everyone out.
function key(): Buffer {
  return createHash("sha256")
    .update(`${process.env.ADMIN_PASSWORD}:${process.env.SUPABASE_SERVICE_ROLE_KEY}`)
    .digest();
}

function sign(value: string): string {
  return createHmac("sha256", key()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string): boolean {
  return adminConfigured() && safeEqual(input, process.env.ADMIN_PASSWORD!);
}

export async function startSession(): Promise<void> {
  const expires = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  await connection(); // admin pages are always rendered per request
  if (!adminConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const [expires, sig] = raw.split(".");
  if (!expires || !sig || Number(expires) < Date.now() / 1000) return false;
  return safeEqual(sig, sign(expires));
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
