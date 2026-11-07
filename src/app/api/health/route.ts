import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";

/** Setup check without revealing any secret: only says which settings are present and working. */
export async function GET() {
  await connection(); // always run at request time, never prerendered
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let serviceRoleWorks = false;
  if (url && key) {
    try {
      // raw_items is not readable with the public key, so this only succeeds with the service key.
      const db = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await db.from("raw_items").select("url", { head: true, count: "exact" }).limit(1);
      serviceRoleWorks = !error;
    } catch {
      serviceRoleWorks = false;
    }
  }
  return Response.json(
    {
      supabaseUrl: Boolean(url),
      serviceRoleKeySet: Boolean(key),
      serviceRoleWorks,
      adminPasswordOk: (process.env.ADMIN_PASSWORD ?? "").length >= 12,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
