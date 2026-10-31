import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/** Server-side client with the service role key: can write. Never expose this key in the website. */
export function adminDb() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}
