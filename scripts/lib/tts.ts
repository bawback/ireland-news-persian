/**
 * Text to speech for the nightly podcast. Two providers:
 *  - ElevenLabs (the owner's cloned voice): ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID
 *  - Azure Speech (ready-made Persian voice): AZURE_SPEECH_KEY + AZURE_SPEECH_REGION (+ AZURE_VOICE)
 * Each returns MP3 bytes for one chunk of text.
 */
import { envOptional } from "./env";

export type TtsProvider = { name: string; speak: (text: string) => Promise<Buffer> };

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

function azure(key: string, preferredRegion: string): TtsProvider {
  const voice = envOptional("AZURE_VOICE") ?? "fa-IR-FaridNeural";
  let regionP: Promise<string> | null = null;
  return {
    name: `Azure (${voice})`,
    async speak(text) {
      regionP ??= findAzureRegion(key, preferredRegion);
      const region = await regionP;
      const ssml = `<speak version="1.0" xml:lang="fa-IR"><voice name="${voice}"><prosody rate="-4%">${xmlEsc(text)}</prosody></voice></speak>`;
      const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
          "User-Agent": "ireland-news-persian",
        },
        body: ssml,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return Buffer.from(await res.arrayBuffer());
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
