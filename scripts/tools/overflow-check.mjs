// Finds elements wider than the phone screen (the cause of sideways wobble when scrolling).
import { chromium, devices } from "playwright";
const site = process.env.SITE_URL || "https://www.irelandnewspersian.com";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fa-IR" });
const page = await ctx.newPage();
await page.goto(site, { waitUntil: "networkidle" });
const article = await page.locator('a[href^="/news/"]').first().getAttribute("href");
for (const path of ["/", article, "/category/ireland", "/guides"]) {
  await page.goto(site + path, { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > vw + 0.5 || b.left < -0.5)) {
        bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} left=${b.left.toFixed(1)} right=${b.right.toFixed(1)}`);
      }
    }
    return { vw, sw: document.documentElement.scrollWidth, bad: bad.slice(0, 15) };
  });
  console.log(`\n${path}: viewport ${r.vw}, page width ${r.sw}`);
  r.bad.forEach((b) => console.log("  " + b));
}
await browser.close();
