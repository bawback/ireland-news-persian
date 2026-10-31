import { test } from "node:test";
import assert from "node:assert/strict";
import { isolateForSocial, splitBidi } from "../src/lib/bidi";

test("keeps multi-word English names together", () => {
  const segs = splitBidi("شورای شهر Dublin City Council اعلام کرد");
  assert.deepEqual(
    segs.filter((s) => s.latin).map((s) => s.text),
    ["Dublin City Council"],
  );
});

test("handles acronyms and numbers inside English runs", () => {
  const latin = splitBidi("مجوز Stamp 4 و کارت IRP لازم است").filter((s) => s.latin).map((s) => s.text);
  assert.deepEqual(latin, ["Stamp 4", "IRP"]);
});

test("pure Persian text is untouched", () => {
  assert.deepEqual(splitBidi("خبر فوری"), [{ text: "خبر فوری", latin: false }]);
});

test("social text gets RLM per line and isolates around English", () => {
  const out = isolateForSocial("خبر درباره HSE\nخط دوم");
  assert.equal(out, "‏خبر درباره ⁨HSE⁩\n‏خط دوم");
});
