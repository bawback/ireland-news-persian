/**
 * Structured data for search engines. `<` is escaped so text coming from articles
 * (for example a stray "</script>") can never break out of the script tag.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
