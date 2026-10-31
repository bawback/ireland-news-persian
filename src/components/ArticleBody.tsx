import { BidiText } from "./BidiText";

type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "list"; items: string[] };

function parse(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => l.startsWith("- "))) {
      blocks.push({ kind: "list", items: lines.map((l) => l.slice(2)) });
    } else if (lines[0].startsWith("## ")) {
      blocks.push({ kind: "h2", text: lines[0].slice(3) });
      if (lines.length > 1) blocks.push(...parse(lines.slice(1).join("\n")));
    } else if (lines.every((l) => l.startsWith("> "))) {
      blocks.push({ kind: "quote", text: lines.map((l) => l.slice(2)).join(" ") });
    } else {
      blocks.push({ kind: "p", text: lines.join(" ") });
    }
  }
  return blocks;
}

export function ArticleBody({ body }: { body: string }) {
  return (
    <div className="prose-fa">
      {parse(body).map((b, i) => {
        switch (b.kind) {
          case "h2":
            return (
              <h2 key={i}>
                <BidiText text={b.text} />
              </h2>
            );
          case "quote":
            return (
              <blockquote key={i}>
                <BidiText text={b.text} />
              </blockquote>
            );
          case "list":
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <BidiText text={it} />
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={i}>
                <BidiText text={b.text} />
              </p>
            );
        }
      })}
    </div>
  );
}
