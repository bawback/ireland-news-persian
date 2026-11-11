"use client";
import { Analytics } from "@vercel/analytics/next";

/** Cookieless visitor stats (Vercel Web Analytics). Admin pages are not counted. */
export function SiteAnalytics() {
  return <Analytics beforeSend={(e) => (new URL(e.url).pathname.startsWith("/admin") ? null : e)} />;
}
