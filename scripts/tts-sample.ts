/** Makes short sample MP3s of the podcast voice, to check pronunciation (podcast.yml input "sample"). */
import { writeFileSync, mkdirSync } from "node:fs";
import { ttsProvider } from "./lib/tts";

const before =
  "سلام، شب‌تون بخیر. سایمون هریس، معاون نخست‌وزیر، امروز در کورک گفت که پلیس ایرلند یا گاردا و سازمان اچ اس ای برنامه تازه‌ای دارند. شرکت رایان‌ایر و ایر لینگوس هم پروازهای تازه‌ای از گالوی اعلام کردند.";
const after =
  "سلام، شب‌تون بخیر. Simon Harris، معاون نخست‌وزیر، امروز در Cork گفت که پلیس ایرلند یا Garda و سازمان HSE برنامه تازه‌ای دارند. شرکت Ryanair و Aer Lingus هم پروازهای تازه‌ای از Galway اعلام کردند.";

const tts = ttsProvider();
if (!tts) throw new Error("No TTS provider configured");
console.log("TTS:", tts.name);
mkdirSync("tts-sample", { recursive: true });
writeFileSync("tts-sample/1-before-persian-letters.mp3", await tts.speak(before));
writeFileSync("tts-sample/2-after-english-letters.mp3", await tts.speak(after));
console.log("done");
