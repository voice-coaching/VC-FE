import { encodeMonoWav } from "./recording-audio";

/** The direct RunPod contract requires actual 16 kHz mono PCM16 samples. */
export async function prepareDirectAudio(source: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer());
    if (decoded.duration < 0.5 || decoded.duration > 180) {
      throw new Error("0.5초 이상, 180초 이하의 음성을 녹음해 주세요.");
    }
    const rendered = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * 16_000),
      16_000,
    );
    const input = rendered.createBufferSource();
    input.buffer = decoded;
    input.connect(rendered.destination);
    input.start();
    const mono = await rendered.startRendering();
    return encodeMonoWav([mono.getChannelData(0)], mono.sampleRate);
  } finally {
    await context.close();
  }
}
