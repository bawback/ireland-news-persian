import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-only Supabase client with full rights. Never import this from a client component. */
export function adminDb(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("adminDb is server-only");
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const IMAGE_BUCKET = "news-images";

export const STATUS_LABELS: Record<string, string> = {
  published: "منتشرشده",
  pending_review: "در انتظار",
  rejected: "پنهان",
};
