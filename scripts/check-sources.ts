/** Checks every feed in sources.ts and prints how many recent items each returns. */
import { SOURCES } from "./sources";
import { fetchFeed } from "./lib/feeds";

async function main() {
  const results = await Promise.allSettled(
    SOURCES.map((s) => fetchFeed(s, 72)),
  );
  // FIND=words prints matching recent items (title contains all words) with their URLs.
  const find = (process.env.FIND ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  results.forEach((r, i) => {
    if (find.length && r.status === "fulfilled")
      for (const it of r.value) if (find.every((w) => it.title.toLowerCase().includes(w))) console.log(`  FOUND ${it.title} | ${it.url}`);
    const s = SOURCES[i];
    if (r.status === "fulfilled")
      console.log(`✓ ${s.nameEn.padEnd(28)} ${r.value.length} items`);
    else
      console.log(`✗ ${s.nameEn.padEnd(28)} ${String(r.reason).slice(0, 100)}`);
  });
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
