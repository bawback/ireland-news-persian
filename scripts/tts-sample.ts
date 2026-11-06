/** Makes short sample MP3s of the podcast voice, to check pronunciation (podcast.yml input "sample"). */
import { writeFileSync, mkdirSync } from "node:fs";
import { ttsProvider } from "./lib/tts";
import { adminDb } from "./lib/db";

const before =
  "سلام، شب‌تون بخیر. سایمون هریس، معاون نخست‌وزیر، امروز در کورک گفت که پلیس ایرلند یا گاردا و سازمان اچ اس ای برنامه تازه‌ای دارند. شرکت رایان‌ایر و ایر لینگوس هم پروازهای تازه‌ای از گالوی اعلام کردند.";
const after =
  "سلام، شب‌تون بخیر. Simon Harris، معاون نخست‌وزیر، امروز در Cork گفت که پلیس ایرلند یا Garda و سازمان HSE برنامه تازه‌ای دارند. شرکت Ryanair و Aer Lingus هم پروازهای تازه‌ای از Galway اعلام کردند.";

async function main() {
  const tts = ttsProvider();
  if (!tts) throw new Error("No TTS provider configured");
  console.log("TTS:", tts.name);
  mkdirSync("tts-sample", { recursive: true });
  const db = adminDb();
  for (const [name, text] of [["1-before", before], ["2-after", after]]) {
    const audio = await tts.speak(text);
    writeFileSync(`tts-sample/${name}.mp3`, audio);
    const path = `podcasts/samples/${name}-${Date.now()}.mp3`;
    const { error } = await db.storage.from("news-images").upload(path, audio, { contentType: "audio/mpeg", upsert: true });
    if (error) throw error;
    console.log("SAMPLE", name, db.storage.from("news-images").getPublicUrl(path).data.publicUrl.replace(/^https:\/\//, ""));
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
