import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { LEVEL_ORDER, stillActive, type WeatherAlert } from "./weather";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Weather warnings that are still running or about to start, worst first.
 * Cached for minutes only, and expired warnings are filtered again when shown,
 * because the Met Éireann licence asks that expired warnings are removed.
 */
export async function getWeatherAlerts(): Promise<WeatherAlert[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("weather");
  if (!url || !anonKey) return [];
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await db
    .from("weather_alerts")
    .select("key, source, level, types, regions, areas_fa, headline_en, title_fa, body_fa, onset, expiry, status, link, updated_at")
    .eq("status", "active")
    .gt("expiry", new Date().toISOString())
    .order("onset", { ascending: true })
    .limit(30);
  if (error) {
    // The table does not exist until supabase/weather.sql is run; the site works without it.
    console.error("weather alerts query failed:", error.message);
    return [];
  }
  return ((data ?? []) as WeatherAlert[]).sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level] || a.onset.localeCompare(b.onset));
}

export { stillActive };
