import { revalidateTag } from "next/cache";

/** Called by the news worker after it publishes new articles, so the site updates immediately. */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  revalidateTag("articles", "max");
  revalidateTag("weather", "max");
  return Response.json({ ok: true });
}
