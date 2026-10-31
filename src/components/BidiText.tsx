import { splitBidi } from "@/lib/bidi";

/** Renders Persian text, keeping every English run isolated so it never jumps around. */
export function BidiText({ text }: { text: string }) {
  return (
    <>
      {splitBidi(text).map((s, i) =>
        s.latin ? (
          <bdi key={i} dir="ltr">
            {s.text}
          </bdi>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}
