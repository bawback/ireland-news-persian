export type Guide = {
  slug: string;
  /** Visible H1. */
  title: string;
  /** <title> tag for search results (about 60 characters). */
  seoTitle: string;
  description: string;
  keywords: string[];
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated: string;
  /** Short bullet summary shown at the top. Supports **bold**. */
  summary: string[];
  /** Body in the ArticleBody format. */
  body: string;
  /** Heading for the FAQ section; defaults to «پرسش‌های رایج». */
  faqTitle?: string;
  faqs: { q: string; a: string }[];
  sources: { name: string; url: string }[];
};
