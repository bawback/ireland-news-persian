import { test } from "node:test";
import assert from "node:assert/strict";
import { areasFa, groupWarnings, inMorningPost, isRelevant, reminderDue, reminderNeeded, whenFa, dublinHour } from "../src/lib/weather";
import { parseMetEireann, parseMetOfficeItems, ukLocalToUtc } from "../scripts/lib/weather-feeds";
import { alertPostText, describeChange, morningText, reminderText } from "../scripts/lib/weather-format";

// Shaped like the live feed on 16 Nov 2026 (Met Éireann splits one warning into wind and rain entries).
const feed = [
  { id: 4, capId: "a", type: "Rain", severity: "Moderate", certainty: "Likely", level: "yellow", issued: "2026-11-15T10:23:43.870801+00:00", updated: "2026-11-15T10:23:43.870801+00:00", onset: "2026-11-16T13:00:00+00:00", expiry: "2026-11-16T23:59:00+00:00", headline: "Status Yellow - Wind and Rain warning for Cork, Waterford", description: "<p>Southwest winds will be strong and gusty.</p><p>Possible impacts:<br>Fallen trees</p>", status: "Warning", regions: ["EI04", "EI27"] },
  { id: 5, capId: "b", type: "Wind", severity: "Moderate", certainty: "Likely", level: "yellow", issued: "2026-11-15T10:23:43.870801+00:00", updated: "2026-11-15T10:23:43.870801+00:00", onset: "2026-11-16T13:00:00+00:00", expiry: "2026-11-16T23:59:00+00:00", headline: "Status Yellow - Wind and Rain warning for Cork, Waterford", description: "<p>Southwest winds will be strong and gusty.</p><p>Possible impacts:<br>Fallen trees</p>", status: "Warning", regions: ["EI04", "EI27"] },
  { id: 6, capId: "c", type: "Wind", severity: "Moderate", certainty: "Likely", level: "yellow", issued: "2026-11-15T10:00:00+00:00", updated: "2026-11-15T10:00:00+00:00", onset: "2026-11-16T13:00:00+00:00", expiry: "2026-11-16T23:59:00+00:00", headline: "Rain and Wind warning for Kerry", description: "Strong winds", status: "Warning", regions: ["EI11"] },
  { id: 7, capId: "d", type: "Rain", severity: "Moderate", certainty: "Likely", level: "yellow", issued: "2026-11-15T10:00:00+00:00", updated: "2026-11-15T10:00:00+00:00", onset: "2026-11-17T06:00:00+00:00", expiry: "2026-11-17T18:00:00+00:00", headline: "Rain warning for Dublin", description: "Heavy rain", status: "Warning", regions: ["EI07"] },
  { id: 8, capId: "e", type: "Rain", severity: "Severe", certainty: "Likely", level: "orange", issued: "2026-11-15T10:00:00+00:00", updated: "2026-11-15T10:00:00+00:00", onset: "2026-11-17T06:00:00+00:00", expiry: "2026-11-17T18:00:00+00:00", headline: "Status Orange - Rain warning for Kerry", description: "Flooding", status: "Warning", regions: ["EI11"] },
];

test("reads the Met Éireann feed and merges wind + rain into one alert", () => {
  const groups = groupWarnings(parseMetEireann(feed));
  assert.equal(groups.length, 4);
  const cork = groups.find((g) => g.regions.includes("EI04"))!;
  assert.deepEqual(cork.types.sort(), ["Rain", "Wind"]);
  assert.equal(cork.description, "Southwest winds will be strong and gusty.\nPossible impacts:\nFallen trees");
  assert.equal(areasFa(cork.regions), "کورک، واترفورد");
});

test("posts storms for the three cities, orange/red anywhere, but not rain alone or yellow elsewhere", () => {
  const groups = groupWarnings(parseMetEireann(feed));
  const by = (h: string) => groups.find((g) => g.headline.includes(h))!;
  assert.equal(isRelevant(by("Cork")), true); // yellow wind + rain, Cork
  assert.equal(isRelevant(by("Rain and Wind warning for Kerry")), false); // yellow, not a watched city
  assert.equal(isRelevant(by("Rain warning for Dublin")), false); // rain alone
  assert.equal(isRelevant(by("Orange - Rain warning for Kerry")), true); // orange anywhere
});

test("a broken feed throws instead of looking empty (so alerts are never wrongly cancelled)", () => {
  assert.throws(() => parseMetEireann({ error: "down" }));
});

test("times are shown in Dublin time with the weekday", () => {
  // 13:00 UTC in November is 13:00 in Dublin; 23:59 stays 23:59.
  assert.equal(whenFa("2026-11-16T13:00:00Z"), "دوشنبه ۱۶ نوامبر، ساعت ۱۳:۰۰");
  // Summer time: 13:00 UTC is 14:00 in Dublin.
  assert.equal(whenFa("2026-07-16T13:00:00Z"), "پنجشنبه ۱۶ ژوئیه، ساعت ۱۴:۰۰");
  // Midnight at the end is shown as 23:59 of the day before.
  assert.equal(whenFa("2026-11-17T00:00:00Z", { isEnd: true }), "دوشنبه ۱۶ نوامبر، ساعت ۲۳:۵۹");
  assert.equal(whenFa("2026-11-16T19:00:00Z", { now: new Date("2026-11-16T08:00:00Z") }), "دوشنبه ۱۶ نوامبر، ساعت ۱۹:۰۰ (امشب)");
});

test("reminder about 4 hours before, never at night", () => {
  assert.equal(new Date(reminderDue("2026-11-16T18:00:00Z")).toISOString(), "2026-11-16T14:00:00.000Z");
  // Onset 09:00 → 05:00 is at night → moved to 22:00 the evening before.
  const due = reminderDue("2026-11-17T09:00:00Z");
  assert.equal(dublinHour(due), 22);
  assert.ok(due < Date.parse("2026-11-17T00:00:00Z"));
});

test("reminder is sent once, only when the first post was well before", () => {
  const a = { onset: "2026-11-16T18:00:00Z", first_posted_at: "2026-11-16T08:00:00Z", reminder_sent_at: null };
  assert.equal(reminderNeeded(a, new Date("2026-11-16T13:00:00Z")), false); // 5 hours before: too early
  assert.equal(reminderNeeded(a, new Date("2026-11-16T14:27:00Z")), true); // 3.5 hours before
  assert.equal(reminderNeeded({ ...a, reminder_sent_at: "2026-11-16T14:27:00Z" }, new Date("2026-11-16T15:27:00Z")), false);
  assert.equal(reminderNeeded({ ...a, first_posted_at: "2026-11-16T14:00:00Z" }, new Date("2026-11-16T14:27:00Z")), false); // just posted
  assert.equal(reminderNeeded(a, new Date("2026-11-16T17:45:00Z")), false); // about to start: too late
  // The morning post at 07:27 is already the warning for an 11:00 storm.
  assert.equal(reminderNeeded({ onset: "2026-11-16T11:00:00Z", first_posted_at: "2026-11-15T12:00:00Z", reminder_sent_at: null, morning_sent_at: "2026-11-16T07:27:00Z" }, new Date("2026-11-16T07:30:00Z")), false);
});

test("morning post covers today's warnings, not ones that start tomorrow afternoon", () => {
  const now = new Date("2026-11-16T07:27:00Z");
  assert.equal(inMorningPost({ onset: "2026-11-16T13:00:00Z", expiry: "2026-11-16T23:59:00Z" }, now), true);
  assert.equal(inMorningPost({ onset: "2026-11-15T13:00:00Z", expiry: "2026-11-16T09:00:00Z" }, now), true); // running now
  assert.equal(inMorningPost({ onset: "2026-11-17T13:00:00Z", expiry: "2026-11-17T20:00:00Z" }, now), false);
});

test("Northern Ireland: Met Office RSS item", () => {
  const items = [
    {
      title: "Amber warning of wind affecting Northern Ireland",
      content: "Amber warning of wind affecting Northern Ireland: Antrim, Down valid from 1500 Thu 19 Nov to 0600 Fri 20 Nov",
      link: "https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings#?date=2026-11-19",
      guid: "abc",
    },
  ];
  const [w] = parseMetOfficeItems(items, new Date("2026-11-16T12:00:00Z"));
  assert.equal(w.level, "orange");
  assert.equal(w.onset, "2026-11-19T15:00:00.000Z");
  assert.equal(w.expiry, "2026-11-20T06:00:00.000Z");
  assert.equal(isRelevant({ ...groupWarnings([w])[0] }), true);
  assert.equal(new Date(ukLocalToUtc(2026, 6, 1, 15, 0)).toISOString(), "2026-07-01T14:00:00.000Z");
});

test("Telegram texts have the exact times, link and hashtags", () => {
  const now = new Date("2026-11-16T08:00:00Z");
  const a = { source: "met_eireann" as const, level: "yellow" as const, types: ["Wind", "Rain"], regions: ["EI04", "EI27"], areas_fa: "کورک، واترفورد", title_fa: "هشدار زرد باد و باران برای کورک و واترفورد", body_fa: "باد شدید جنوب‌غربی.", onset: "2026-11-16T13:00:00Z", expiry: "2026-11-16T23:59:00Z" };
  const post = alertPostText(a, "https://x.ie/weather#w-1", now);
  assert.match(post, /🟡 <b>/);
  assert.match(post, /شروع:<\/b> دوشنبه ۱۶ نوامبر، ساعت ۱۳:۰۰ \(امروز\)/);
  assert.match(post, /پایان:<\/b> دوشنبه ۱۶ نوامبر، ساعت ۲۳:۵۹ \(امشب\)/);
  assert.match(post, /#کورک/);
  assert.match(post, /href="https:\/\/x.ie\/weather#w-1"/);
  assert.match(reminderText(a, "https://x.ie/weather", new Date("2026-11-16T09:30:00Z")), /حدود ۳٫۵ ساعت دیگر شروع می‌شود/);
  assert.match(morningText([a], "https://x.ie/weather", new Date("2026-11-16T07:27:00Z")), /صبح بخیر/);
  assert.equal(
    describeChange({ level: "yellow", onset: a.onset, expiry: a.expiry, regions: a.regions }, { level: "orange", onset: a.onset, expiry: a.expiry, regions: a.regions, areas_fa: a.areas_fa }),
    "سطح هشدار از زرد به نارنجی بالا رفت.",
  );
});
