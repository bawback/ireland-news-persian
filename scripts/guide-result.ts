/** Writes guide-result.txt (slug, title, description) for an existing guide, so announce-guide.ts can post it. */
import { writeFileSync } from "node:fs";
import { getGuide } from "../src/content/guides";

const slug = process.argv[2] ?? "";
const g = getGuide(slug);
if (!g) {
  console.error(`No guide with slug "${slug}".`);
  process.exit(1);
}
writeFileSync("guide-result.txt", [g.slug, g.title, g.description].join("\n"));
console.log(`Prepared announcement for ${g.slug}`);
