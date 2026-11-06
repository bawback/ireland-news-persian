/**
 * Text to speech for the nightly podcast. Two providers:
 *  - ElevenLabs (the owner's cloned voice): ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID
 *  - Azure Speech (ready-made Persian voice): AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (+ AZURE_VOICE)
 * Each returns MP3 bytes for one chunk of text.
 */
import { envOptional } from "./env";

export type TtsProvider = {
  name: string;
  speak: (text: string) => Promise<Buffer>;
};

function elevenlabs(key: string, voiceId: string): TtsProvider {
  const model = envOptional("ELEVENLABS_MODEL") ?? "eleven_v3";
  return {
    name: `ElevenLabs (${model})`,
    async speak(text) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: model, language_code: "fa" }),
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

const xmlEsc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Regions to try when the configured one rejects the key (a key only works in its own region).
const AZURE_REGIONS = [
  "northeurope", "westeurope", "uksouth", "ukwest", "swedencentral", "francecentral", "germanywestcentral",
  "switzerlandnorth", "norwayeast", "polandcentral", "italynorth", "spaincentral", "eastus", "eastus2", "westus",
  "westus2", "westus3", "centralus", "northcentralus", "southcentralus", "westcentralus", "canadacentral",
  "canadaeast", "brazilsouth", "southeastasia", "eastasia", "japaneast", "japanwest", "koreacentral",
  "australiaeast", "centralindia", "southindia", "uaenorth", "qatarcentral", "southafricanorth",
];

async function keyWorksIn(key: string, region: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" },
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findAzureRegion(key: string, preferred: string): Promise<string> {
  if (await keyWorksIn(key, preferred)) return preferred;
  for (const r of AZURE_REGIONS) {
    if (r !== preferred && (await keyWorksIn(key, r))) {
      console.log(`Azure key belongs to region "${r}", not "${preferred}". Using "${r}". (Set AZURE_SPEECH_REGION=${r} to skip this check.)`);
      return r;
    }
  }
  throw new Error(
    `Azure rejected AZURE_SPEECH_KEY in every region (key length ${key.length}). Re-copy KEY 1 from the Speech resource's "Keys and Endpoint" page.`,
  );
}

// Non-Persian words (names, places, English terms) are written in Latin letters in the script.
// The Persian voice can't pronounce them, so each Latin run is read by an Irish-English voice
// of the same gender, inside the same SSML request.
const LATIN_RUN = /[A-Za-z][A-Za-z0-9'’.&\-]*(?:[ \t]+[A-Za-z0-9][A-Za-z0-9'’.&\-]*)*/g;
const FEMALE_FA = /Dilara/i;

export function toSsml(text: string, voice: string, foreignVoice: string): string {
  const fa = (t: string) => (t.trim() ? `<voice name="${voice}"><prosody rate="-4%">${xmlEsc(t)}</prosody></voice>` : "");
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    const word = m[0].replace(/[.\-]+$/, "");
    out += fa(text.slice(last, m.index));
    out += `<voice name="${foreignVoice}"><prosody rate="-4%">${xmlEsc(word)}</prosody></voice>`;
    last = m.index! + word.length;
  }
  out += fa(text.slice(last));
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="fa-IR">${out}</speak>`;
}

function azure(key: string, preferredRegion: string): TtsProvider {
  const voice = envOptional("AZURE_VOICE") ?? "fa-IR-FaridNeural";
  const foreignVoice =
    envOptional("AZURE_FOREIGN_VOICE") ?? (FEMALE_FA.test(voice) ? "en-IE-EmilyNeural" : "en-IE-ConnorNeural");
  let regionP: Promise<string> | null = null;

  async function speakOne(text: string, region: string): Promise<Buffer> {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
        "User-Agent": "ireland-news-persian",
      },
      body: toSsml(text, voice, foreignVoice),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  }

  return {
    name: `Azure (${voice} + ${foreignVoice})`,
    async speak(text) {
      regionP ??= findAzureRegion(key, preferredRegion);
      const region = await regionP;
      // Azure allows at most 50 <voice> elements per request, so a text with many
      // English words is sent in groups of sentences and the MP3s are joined.
      const runs = (t: string) => (t.match(LATIN_RUN) ?? []).length;
      const parts: string[] = [];
      let cur = "";
      for (const sentence of text.split(/(?<=[.!?؟])\s+/)) {
        if (cur && runs(`${cur} ${sentence}`) > 22) {
          parts.push(cur);
          cur = sentence;
        } else cur = cur ? `${cur} ${sentence}` : sentence;
      }
      if (cur) parts.push(cur);
      const out: Buffer[] = [];
      for (const part of parts) out.push(await speakOne(part, region));
      return Buffer.concat(out);
    },
  };
}

export function ttsProvider(): TtsProvider | null {
  const elKey = envOptional("ELEVENLABS_API_KEY");
  const elVoice = envOptional("ELEVENLABS_VOICE_ID");
  if (elKey && elVoice) return elevenlabs(elKey, elVoice);
  const azKey = envOptional("AZURE_SPEECH_KEY")?.trim();
  const azRegion = envOptional("AZURE_SPEECH_REGION")?.trim().toLowerCase().replace(/\s+/g, "") || "northeurope";
  if (azKey) return azure(azKey, azRegion);
  return null;
}
