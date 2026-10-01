export function encodeMonoWav(
  chunks: readonly Float32Array[],
  sampleRate: number,
) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error("녹음된 음성이 없습니다. 다시 녹음해 주세요.");
  }
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, length * 2, true);
  let offset = 44;
  for (const chunk of chunks) {
    for (const value of chunk) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true,
      );
      offset += 2;
    }
  }
  return {
    blob: new Blob([buffer], { type: "audio/wav" }),
    durationMs: Math.round((length / sampleRate) * 1_000),
  };
}

export async function playRecordingCue(context: AudioContext) {
  await context.resume();
  if (context.state !== "running")
    throw new Error("오디오를 시작하지 못했습니다. 다시 시도해 주세요.");
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  const now = context.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain.gain.setValueAtTime(0.15, now + 0.12);
  gain.gain.linearRampToValueAtTime(0, now + 0.16);
  oscillator.connect(gain).connect(context.destination);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      oscillator.disconnect();
      gain.disconnect();
      reject(new Error("녹음 준비가 중단됐습니다. 다시 시도해 주세요."));
    }, 3_000);
    oscillator.onended = () => {
      clearTimeout(timeout);
      oscillator.disconnect();
      gain.disconnect();
      resolve();
    };
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  });
  // Leave a short gap so the speaker's cue is not part of the recording.
  await new Promise((resolve) => setTimeout(resolve, 100));
}

export async function createPcmRecording(
  context: AudioContext,
  stream: MediaStream,
) {
  await context.audioWorklet.addModule("/audio/recording-processor.js");
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "speakai-recorder");
  const chunks: Float32Array[] = [];
  let finish: (() => void) | undefined;
  let failure: (() => void) | undefined;
  let failed = false;
  let disposed = false;
  node.onprocessorerror = () => {
    failed = true;
    failure?.();
  };
  node.port.onmessage = ({ data }) => {
    if (data.type === "samples") chunks.push(data.samples);
    if (data.type === "stopped") finish?.();
  };
  source.connect(node);
  // The processor outputs silence, keeping the graph alive without mic feedback.
  node.connect(context.destination);
  return {
    start() {
      node.port.postMessage("start");
    },
    async stop() {
      if (failed || disposed)
        throw new Error("녹음이 중단됐습니다. 다시 녹음해 주세요.");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () =>
            reject(
              new Error("녹음을 마무리하지 못했습니다. 다시 녹음해 주세요."),
            ),
          3_000,
        );
        finish = () => {
          clearTimeout(timeout);
          resolve();
        };
        failure = () => {
          clearTimeout(timeout);
          reject(new Error("녹음이 중단됐습니다. 다시 녹음해 주세요."));
        };
        node.port.postMessage("stop");
      });
      return encodeMonoWav(chunks, context.sampleRate);
    },
    dispose() {
      disposed = true;
      failure?.();
      source.disconnect();
      node.disconnect();
      node.port.close();
      chunks.length = 0;
    },
  };
}
