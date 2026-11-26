import { test } from "node:test";
import assert from "node:assert/strict";
import { addNiHashtag, decideRegion, isNorthernIreland, labelPost, labelSocialPosts, mentionsNorthernIreland, NI_BADGE } from "../src/lib/region";
import { telegramNewsText } from "../scripts/lib/telegram-format";

test("spots Northern Ireland places and institutions in English headlines", () => {
  for (const t of ["Man charged after Belfast stabbing", "PSNI appeal for witnesses", "Stormont budget row", "Crash in Co Tyrone", "Derry City win", "DUP leader speaks"])
    assert.ok(mentionsNorthernIreland(t), t);
  for (const t of ["Tyrone beat Kerry in All-Ireland final", "Ulster GAA draw: Donegal v Cavan", "Dublin rents rise", "Bangor University study", "Duplicate payments to be refunded"])
    assert.ok(!mentionsNorthernIreland(t), t);
});

test("the classifier decides; source and headline only fill a gap", () => {
  assert.equal(decideRegion({ classifier: "northern_ireland", category: "sport", sourceIsNi: false, text: "" }), "ni");
  assert.equal(decideRegion({ classifier: "republic", category: "law", sourceIsNi: true, text: "Belfast" }), "roi");
  assert.equal(decideRegion({ classifier: "other", category: "economy", sourceIsNi: true, text: "" }), "ni");
  assert.equal(decideRegion({ classifier: undefined, category: "ireland", sourceIsNi: false, text: "PSNI arrest" }), "ni");
  assert.equal(decideRegion({ classifier: "both", category: "northern-ireland", sourceIsNi: false, text: "" }), "ni");
});

test("old articles without a region fall back to category, source and headline", () => {
  assert.ok(isNorthernIreland({ category: "northern-ireland" }));
  assert.ok(isNorthernIreland({ category: "sport", source_id: "bbc-ni" }));
  assert.ok(isNorthernIreland({ category: "law", source_title: "Belfast court hears case" }));
  assert.ok(!isNorthernIreland({ category: "law", social: { region: "roi" }, source_title: "Belfast-born judge appointed in Dublin" }));
  assert.ok(!isNorthernIreland({ category: "ireland", source_id: "rte", source_title: "Dublin Bus fares" }));
});

test("labels are added once", () => {
  const x = labelPost("خبر فوری");
  assert.equal(x, `${NI_BADGE}\nخبر فوری`);
  assert.equal(labelPost(x), x);
  const tg = "🚨 تیتر\nمتن\n#اخبار_ایرلند #جنایی";
  assert.equal(addNiHashtag(tg), "🚨 تیتر\nمتن\n#اخبار_ایرلند #جنایی #ایرلند_شمالی");
  assert.equal(addNiHashtag(addNiHashtag(tg)), addNiHashtag(tg));
  assert.equal(addNiHashtag("بدون هشتگ"), "بدون هشتگ");
  const posts = labelSocialPosts({ telegram: tg, x: "تیتر", whatsapp: "تیتر" }, true);
  assert.ok(posts.x!.startsWith(NI_BADGE) && posts.whatsapp!.startsWith(NI_BADGE));
  assert.ok(!posts.telegram!.startsWith(NI_BADGE) && posts.telegram!.includes("#ایرلند_شمالی"));
  assert.deepEqual(labelSocialPosts({ x: "تیتر" }, false), { x: "تیتر" });
});

test("Telegram post starts with the label and keeps the headline bold", () => {
  const html = telegramNewsText("🚨 تیتر خبر\nمتن\n#اخبار_ایرلند", "https://x.ie/news/a", { ni: true });
  const lines = html.split("\n");
  assert.equal(lines[0], "📍 <b>ایرلند شمالی</b>");
  assert.ok(lines[1].startsWith("<b>") && lines[1].includes("تیتر خبر"));
  assert.ok(html.includes("#ایرلند_شمالی"));
  // Already labelled text is not labelled twice.
  assert.equal(telegramNewsText(`${NI_BADGE}\n🚨 تیتر خبر\nمتن\n#اخبار_ایرلند`, "https://x.ie/news/a", { ni: true }), html);
  assert.ok(!telegramNewsText("تیتر", "https://x.ie/news/a").includes("ایرلند شمالی"));
});
