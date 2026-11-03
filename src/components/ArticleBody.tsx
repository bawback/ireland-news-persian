import { BidiText } from "./BidiText";

/**
 * Renders the simple text format used by articles and guides:
 * blank line = new paragraph, "## " / "### " = subheadings, "> " = highlighted note,
 * "- " = bullet list, "1. " = numbered list. Inside text: **bold** and [link](https://…).
 */
type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string; id?: string }
  | { kind: "h3"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "olist"; items: string[] };

const NUMBERED = /^[0-9۰-۹]+[.)]\s+/;

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines[0].startsWith("## ") || lines[0].startsWith("### ")) {
      const h3 = lines[0].startsWith("### ");
      const raw = lines[0].slice(h3 ? 4 : 3);
      // Optional anchor: "## Title {#anchor}"
      const m = raw.match(/^(.*?)\s*\{#([a-z0-9-]+)\}$/);
      blocks.push(h3 ? { kind: "h3", text: m ? m[1] : raw } : { kind: "h2", text: m ? m[1] : raw, id: m?.[2] });
      if (lines.length > 1) blocks.push(...parse(lines.slice(1).join("\n")));
    } else if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ kind: "list", items: lines.map((l) => l.slice(2)) });
    } else if (lines.every((l) => NUMBERED.test(l))) {
      blocks.push({ kind: "olist", items: lines.map((l) => l.replace(NUMBERED, "")) });
    } else if (lines.every((l) => l.startsWith("> "))) {
      blocks.push({ kind: "quote", text: lines.map((l) => l.slice(2)).join(" ") });
    } else {
      blocks.push({ kind: "p", text: lines.join(" ") });
    }
  }
  return blocks;
}

/** **bold** and [text](https://url) inside a line; everything else goes through BidiText. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i}>
              <BidiText text={part.slice(2, -2)} />
            </strong>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
        if (link) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noopener" className="text-brand underline underline-offset-4">
              <BidiText text={link[1]} />
            </a>
          );
        }
        return <BidiText key={i} text={part} />;
      })}
    </>
  );
}

export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="prose-fa">
      {parse(body).map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2 key={i} id={b.id} className="scroll-mt-36">
                <Inline text={b.text} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i}>
                <Inline text={b.text} />
              </h3>
            );
          case "quote":
            return (
              <blockquote key={i}>
                <Inline text={b.text} />
              </blockquote>
            );
          case "list":
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ul>
            );
          case "olist":
            return (
              <ol key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
