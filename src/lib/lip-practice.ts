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
  | "unavailable";

export type LipClip = {
  promptIndex: number;
  url: string;
  blob: Blob;
};

export function preferredVideoMimeType(supports: (mime: string) => boolean) {
  return [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ].find(supports);
}

export function releaseLipResources(
  stream: MediaStream | null,
  clips: ReadonlyArray<Pick<LipClip, "url">>,
  revoke = URL.revokeObjectURL,
) {
  stream?.getTracks().forEach((track) => track.stop());
  clips.forEach((clip) => revoke(clip.url));
}
