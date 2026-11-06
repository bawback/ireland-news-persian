import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

export const PODCAST = {
  name: process.env.NEXT_PUBLIC_PODCAST_NAME || "شب بخیر ایرلند",
  tagline: "مرور مهم‌ترین خبرهای امروز ایرلند به فارسی، هر شب ساعت ۱۰",
};

export interface Episode {
  id: string;
  episode_date: string;
  title: string;
  description: string;
  script: string;
  audio_url: string;
  duration_sec: number;
  size_bytes: number;
  created_at: string;
  telegram_message_id?: number | null;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Latest episodes, newest first. Empty while the podcasts table does not exist yet. */
export async function getEpisodes(limit = 30): Promise<Episode[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  if (!url || !anonKey) return [];
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await db.from("podcasts").select("*").order("episode_date", { ascending: false }).limit(limit);
  if (error) {
    console.error("podcasts query failed:", error.message);
    return [];
  }
  return (data as Episode[] | null) ?? [];
}

export const minutes = (sec: number) => `${Math.max(1, Math.round(sec / 60)).toLocaleString("fa-IR")} دقیقه`;
