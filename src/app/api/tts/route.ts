import { protos, TextToSpeechClient } from "@google-cloud/text-to-speech";
import { findPracticeExample } from "@/lib/practice-examples";

export const runtime = "nodejs";

const client = new TextToSpeechClient();
const audioCache = new Map<string, Promise<Buffer>>();
const DEFAULT_CHIRP_VOICE = "ko-KR-Chirp3-HD-Aoede";

async function synthesize(
  example: NonNullable<ReturnType<typeof findPracticeExample>>,
) {
  const cached = audioCache.get(example.id);
  if (cached) return cached;

  const request = client
    .synthesizeSpeech({
      input: { text: example.text },
      voice: {
        languageCode: "ko-KR",
        name: process.env.GOOGLE_CLOUD_TTS_VOICE || DEFAULT_CHIRP_VOICE,
      },
      audioConfig: {
        audioEncoding: protos.google.cloud.texttospeech.v1.AudioEncoding.MP3,
        speakingRate: 0.92,
      },
    })
    .then(([response]) => {
      if (!response.audioContent)
        throw new Error("Google TTS가 빈 음성을 반환했습니다.");
      return typeof response.audioContent === "string"
        ? Buffer.from(response.audioContent, "base64")
        : Buffer.from(response.audioContent);
    });

  audioCache.set(example.id, request);
  try {
    return await request;
  } catch (reason) {
    audioCache.delete(example.id);
    throw reason;
  }
}

export async function GET(request: Request) {
  const exampleId = new URL(request.url).searchParams.get("exampleId");
  const example = findPracticeExample(exampleId);
  if (!example)
    return Response.json(
      { code: "UNKNOWN_TTS_EXAMPLE", message: "등록되지 않은 예문입니다." },
      { status: 400 },
    );

  try {
    const audio = await synthesize(example);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=86400",
        "Content-Length": String(audio.byteLength),
      },
    });
  } catch {
    return Response.json(
      {
        code: "GOOGLE_TTS_UNAVAILABLE",
        message: "Google Chirp 음성을 생성하지 못했습니다.",
      },
      { status: 503 },
    );
  }
}
