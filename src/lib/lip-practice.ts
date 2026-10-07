export const LIP_PRACTICE_PROMPTS = [
  "오늘 하루도 차분하게 시작해 봐요.",
  "정확한 발음은 천천히 말하는 것부터 시작해요.",
  "입을 충분히 벌리고 또박또박 읽어 보세요.",
  "문장 끝까지 목소리에 힘을 유지해요.",
  "매일 짧게 연습하면 말하기가 자연스러워져요.",
] as const;

export type LipPracticeStep =
  | "guide"
  | "tips"
  | "setup"
  | "permission"
  | "align"
  | "countdown"
  | "recording"
  | "review"
  | "complete";

export type LipClip = {
  promptIndex: number;
  url: string;
  blob: Blob;
  audioBlob?: Blob;
  durationMs: number;
};

export function preferredVideoMimeType(supports: (mime: string) => boolean) {
  return [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find(supports);
}

export function normalizeVideoMimeType(mimeType: string) {
  return mimeType.split(";", 1)[0]?.trim().toLowerCase() || "video/mp4";
}

export function prepareVideoForAnalysis(
  source: Blob,
  acceptedMimeTypes: string[],
) {
  const sourceMimeType = normalizeVideoMimeType(source.type);
  const accepted = acceptedMimeTypes.map(normalizeVideoMimeType);
  if (!accepted.includes(sourceMimeType)) {
    throw new Error(
      `이 기기의 영상 형식(${sourceMimeType})을 서버가 지원하지 않습니다.`,
    );
  }

  const extensions: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return {
    blob: source.slice(0, source.size, sourceMimeType),
    mimeType: sourceMimeType,
    extension: extensions[sourceMimeType] ?? "video",
  };
}

export function releaseLipResources(
  stream: MediaStream | null,
  clips: ReadonlyArray<Pick<LipClip, "url">>,
  revoke = URL.revokeObjectURL,
) {
  stream?.getTracks().forEach((track) => track.stop());
  clips.forEach((clip) => revoke(clip.url));
}
