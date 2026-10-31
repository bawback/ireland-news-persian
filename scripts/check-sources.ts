/** Checks every feed in sources.ts and prints how many recent items each returns. */
import { SOURCES } from "./sources";
import { fetchFeed } from "./lib/feeds";

const results = await Promise.allSettled(SOURCES.map((s) => fetchFeed(s, 72)));
results.forEach((r, i) => {
  const s = SOURCES[i];
  if (r.status === "fulfilled") console.log(`✓ ${s.nameEn.padEnd(28)} ${r.value.length} items`);
  else console.log(`✗ ${s.nameEn.padEnd(28)} ${String(r.reason).slice(0, 100)}`);
});
