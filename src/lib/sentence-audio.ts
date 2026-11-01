import { encodeMonoWav } from "./recording-audio";

/** Split one live PCM stream into independent files without restarting the microphone. */
export async function createSentenceAudio(
  context: AudioContext,
  stream: MediaStream,
) {
  await context.audioWorklet.addModule(
    "/audio/recording-processor.js?sentences=v2",
  );
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "speakai-recorder");
  let chunks: Float32Array[] = [];
  let failed = false;
  let pending: {
    resolve: (blob: Blob) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  node.port.onmessage = ({ data }) => {
    if (data.type === "samples") chunks.push(data.samples);
    if (data.type === "segment" && pending) {
      const request = pending;
      pending = null;
      clearTimeout(request.timer);
      const completed = chunks;
      chunks = [];
      try {
        request.resolve(encodeMonoWav(completed, context.sampleRate).blob);
      } catch (reason) {
        request.reject(
          reason instanceof Error
            ? reason
            : new Error("문장 녹음을 확인하지 못했어요."),
        );
      }
    }
  };
  node.onprocessorerror = () => {
    failed = true;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("문장 녹음이 중단됐어요."));
      pending = null;
    }
  };
  source.connect(node);
  node.connect(context.destination);
  return {
    start(): void {
      node.port.postMessage("start");
    },
    pause(): void {
      node.port.postMessage("pause");
    },
    resume(): void {
      node.port.postMessage("resume");
    },
    split(): Promise<Blob> {
      if (failed) return Promise.reject(new Error("문장 녹음이 중단됐어요."));
      if (pending)
        return Promise.reject(new Error("문장 녹음을 나누는 중이에요."));
      return new Promise((resolve, reject) => {
        pending = {
          resolve,
          reject,
          timer: setTimeout(() => {
            pending = null;
            reject(new Error("문장 녹음을 나누지 못했어요."));
          }, 3000),
        };
        node.port.postMessage({ type: "split" });
      });
    },
    dispose(): void {
      if (pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error("녹음을 종료했어요."));
        pending = null;
      }
      source.disconnect();
      node.disconnect();
      node.port.close();
      chunks = [];
    },
  };
}
