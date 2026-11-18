export const SITE = {
  name: "اخبار ایرلند به فارسی",
  nameEn: "Ireland News Persian",
  /** Other names people search for; used in structured data so search engines connect them to this site. */
  alternateNames: ["اخبار ایرلند", "اخبار ایرلند فارسی", "اخبار فارسی ایرلند", "Ireland News Persian", "Ireland News in Persian"],
  /** Home page title. Starts with the main search phrases: «اخبار ایرلند», «اخبار ایرلند فارسی», «ایرلند». */
  homeTitle: "اخبار ایرلند به فارسی | اخبار امروز ایرلند، دابلین و ایرلند شمالی",
  description:
    "اخبار ایرلند به فارسی: تازه‌ترین اخبار امروز ایرلند و ایرلند شمالی از منابع معتبر؛ مهاجرت و اقامت، اقتصاد و کار، مسکن، قوانین، ورزش و فرهنگ.",
  keywords: [
    "اخبار ایرلند",
    "اخبار ایرلند فارسی",
    "اخبار ایرلند به فارسی",
    "ایرلند",
    "اخبار امروز ایرلند",
    "اخبار دابلین",
    "اخبار ایرلند شمالی",
    "مهاجرت به ایرلند",
    "ایرانیان ایرلند",
    "Ireland news Persian",
  ],
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || "https://t.me/IrelandNewsPersian",
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
  x: process.env.NEXT_PUBLIC_X_URL ?? "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",
};

/**
 * IndexNow key (Bing, Yandex, Seznam, Naver…). It is public by design: the same value is served at
 * /indexnow-key.txt so the search engines can check that the pings really come from this site.
 */
export const INDEXNOW_KEY = "b7c41e2a9d6f4e0c8a3b5d1f7e9c2a64";

/** Shared structured-data ids, so every page points at the same organisation and website. */
export const LD_IDS = {
  org: `${SITE.url}/#organization`,
  website: `${SITE.url}/#website`,
};

export const LOGO_URL = `${SITE.url}/brand/logo-1024.png`;

/** The organisation behind the site, as schema.org NewsMediaOrganization. */
export function organizationLd() {
  return {
    "@type": "NewsMediaOrganization",
    "@id": LD_IDS.org,
    name: SITE.name,
    alternateName: SITE.alternateNames,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: LOGO_URL, width: 1024, height: 1024 },
    image: LOGO_URL,
    description: SITE.description,
    areaServed: [
      { "@type": "Country", name: "Ireland" },
      { "@type": "Place", name: "Northern Ireland" },
    ],
    knowsLanguage: ["fa", "en"],
    publishingPrinciples: `${SITE.url}/about`,
    sameAs: [SITE.telegram, SITE.instagram, SITE.x].filter(Boolean),
    ...(SITE.contactEmail ? { email: SITE.contactEmail } : {}),
  };
}
