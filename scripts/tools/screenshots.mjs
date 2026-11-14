// Takes LinkedIn-ready screenshots of the site and the public Telegram channel page.
import { chromium, devices } from "playwright";
import { mkdirSync } from "node:fs";

const site = process.env.SITE_URL || "https://www.irelandnewspersian.com";
const out = "shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

async function shot(name, url, opts, prep) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  if (prep) await prep(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("saved", name);
  await ctx.close();
}

const desktop = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, locale: "fa-IR" };
const phone = { ...devices["iPhone 13"], locale: "fa-IR" };

await shot("1-home-desktop", site, desktop);
await shot("2-home-phone", site, phone);
// First article linked from the home page
const ctx = await browser.newContext(desktop);
const p = await ctx.newPage();
await p.goto(site, { waitUntil: "networkidle" });
const article = await p.locator('a[href^="/news/"]').first().getAttribute("href");
const guide = await p.locator('a[href^="/guides/"]').nth(1).getAttribute("href");
await ctx.close();
await shot("3-article-phone", site + article, phone);
await shot("4-guide-desktop", site + guide, desktop);
await shot("5-telegram-channel", "https://t.me/s/IrelandNewsPersian", phone, async (page) => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
});
await browser.close();
