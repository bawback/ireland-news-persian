import { INDEXNOW_KEY } from "@/lib/site";

/** IndexNow ownership file: search engines fetch it to check pings sent by the news worker. */
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
