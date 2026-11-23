/**
 * News sources.
 *
 * kind:
 *  - "open":  official/government content published under an open licence that allows
 *             re-use with attribution (e.g. CC BY 4.0, UK Open Government Licence).
 *             -> we publish a full, faithful Persian translation.
 *  - "media": commercial news outlets. Their articles are copyrighted.
 *             -> we write an original Persian news report from the facts and link to the source.
 *
 * Feed URLs marked `verify: true` were not reachable from the build machine; run
 * `npm run check-sources` (or the "Check sources" GitHub Action) to confirm them.
 */
export type SourceKind = "open" | "media";

export interface Source {
  id: string;
  name: string; // Persian display name
  nameEn: string;
  feed: string;
  kind: SourceKind;
  /** Category hint for the classifier */
  hint?: string;
  /** Higher wins when two sources cover the same story */
  priority: number;
  licence?: string;
  verify?: boolean;
}

export const SOURCES: Source[] = [
  // --- Entertainment, what's on, fun Irish stories (media) ---
  // Lovin Dublin, Her.ie and Virgin Media News have no public RSS feed that works from GitHub (checked Nov 2026).
  { id: "joe", name: "جو", nameEn: "JOE.ie", feed: "https://www.joe.ie/feed", kind: "media", hint: "entertainment", priority: 5 },
  { id: "rte-entertainment", name: "آر‌تی‌ای", nameEn: "RTÉ Entertainment", feed: "https://www.rte.ie/feeds/rss/?index=/entertainment/", kind: "media", hint: "entertainment", priority: 6 },
  { id: "dublin-live", name: "دابلین لایو", nameEn: "Dublin Live", feed: "https://www.dublinlive.ie/?service=rss", kind: "media", hint: "entertainment", priority: 4 },
  { id: "hotpress", name: "هات‌پرس", nameEn: "Hot Press", feed: "https://www.hotpress.com/feed", kind: "media", hint: "entertainment", priority: 4 },
  { id: "totally-dublin", name: "توتالی دابلین", nameEn: "Totally Dublin", feed: "https://www.totallydublin.ie/feed/", kind: "media", hint: "entertainment", priority: 4 },

  // --- Republic of Ireland: general news (media) ---
  { id: "rte-news", name: "آر‌تی‌ای", nameEn: "RTÉ News", feed: "https://www.rte.ie/feeds/rss/?index=/news/", kind: "media", priority: 9, verify: true },
  // Politics, health and RTÉ's own analysis: where the day's big rows (HSE, hospitals, Dáil) and the
  // interviews from RTÉ Radio 1 (Morning Ireland, News at One, Drivetime...) are written up as text.
  // The programme pages' own RSS feeds (/radio/radio1/...) are no longer updated (checked Nov 2026).
  { id: "rte-politics", name: "آر‌تی‌ای", nameEn: "RTÉ News Politics", feed: "https://www.rte.ie/feeds/rss/?index=/news/politics/", kind: "media", hint: "politics", priority: 9 },
  { id: "rte-health", name: "آر‌تی‌ای", nameEn: "RTÉ News Health", feed: "https://www.rte.ie/feeds/rss/?index=/news/health/", kind: "media", hint: "health", priority: 9 },
  { id: "rte-analysis", name: "آر‌تی‌ای", nameEn: "RTÉ Analysis", feed: "https://www.rte.ie/feeds/rss/?index=/news/analysis-and-comment/", kind: "media", priority: 8 },
  { id: "rte-business", name: "آر‌تی‌ای", nameEn: "RTÉ Business", feed: "https://www.rte.ie/feeds/rss/?index=/news/business/", kind: "media", hint: "economy", priority: 8, verify: true },
  { id: "rte-sport", name: "آر‌تی‌ای", nameEn: "RTÉ Sport", feed: "https://www.rte.ie/feeds/rss/?index=/sport/", kind: "media", hint: "sport", priority: 8, verify: true },
  { id: "thejournal", name: "دژورنال", nameEn: "TheJournal.ie", feed: "https://www.thejournal.ie/feed/", kind: "media", priority: 7, verify: true },
  { id: "irish-examiner", name: "آیریش اگزمینر", nameEn: "Irish Examiner", feed: "https://www.irishexaminer.com/feed/35-top_news.xml", kind: "media", priority: 7, verify: true },
  // BreakingNews.ie RSS has not been updated since September 2026.
  // { id: "breakingnews", name: "بریکینگ‌نیوز", nameEn: "BreakingNews.ie", feed: "https://feeds.breakingnews.ie/bnireland", kind: "media", priority: 6, verify: true },
  { id: "independent", name: "آیریش ایندیپندنت", nameEn: "Irish Independent", feed: "https://www.independent.ie/irish-news/rss", kind: "media", priority: 7, verify: true },
  { id: "irish-mirror", name: "آیریش میرر", nameEn: "Irish Mirror", feed: "https://www.irishmirror.ie/news/irish-news/?service=rss", kind: "media", priority: 5, verify: true },
  { id: "irish-times", name: "آیریش تایمز", nameEn: "The Irish Times", feed: "https://www.irishtimes.com/arc/outboundfeeds/feed-irish-news/?outputType=xml", kind: "media", priority: 8, verify: true },
  { id: "silicon-republic", name: "سیلیکون ریپابلیک", nameEn: "Silicon Republic", feed: "https://www.siliconrepublic.com/feed/", kind: "media", hint: "tech", priority: 5, verify: true },
  { id: "the42", name: "دِ فورتی‌تو", nameEn: "The42", feed: "https://www.the42.ie/feed/", kind: "media", hint: "sport", priority: 5, verify: true },

  // --- Northern Ireland (media) ---
  { id: "bbc-ni", name: "بی‌بی‌سی ایرلند شمالی", nameEn: "BBC News NI", feed: "https://feeds.bbci.co.uk/news/northern_ireland/rss.xml", kind: "media", hint: "northern-ireland", priority: 9 },
  { id: "belfast-telegraph", name: "بلفاست تلگراف", nameEn: "Belfast Telegraph", feed: "https://www.belfasttelegraph.co.uk/news/northern-ireland/rss", kind: "media", hint: "northern-ireland", priority: 6, verify: true },

  // --- Official sources ---
  // gov.ie blocks requests from GitHub Actions servers (403 on every URL, even robots.txt), so it is left out for now.
  // { id: "gov-ie", name: "دولت ایرلند", nameEn: "gov.ie", feed: "https://www.gov.ie/en/rss/press-releases/", kind: "open", priority: 10, licence: "CC BY 4.0 (check gov.ie copyright notice)", verify: true },
  { id: "irish-immigration", name: "اداره خدمات مهاجرت ایرلند", nameEn: "Irish Immigration Service", feed: "https://www.irishimmigration.ie/feed/", kind: "media", hint: "immigration", priority: 10, verify: true },
  { id: "nidirect", name: "دولت ایرلند شمالی", nameEn: "nidirect", feed: "https://www.nidirect.gov.uk/news-rss.xml", kind: "open", hint: "northern-ireland", priority: 8, licence: "Open Government Licence v3.0" },
];
