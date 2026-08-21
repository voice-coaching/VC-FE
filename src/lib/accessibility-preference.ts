export type AudioAccessPreference =
  "audio_comfortable" | "text_support_preferred" | "text_first" | "flexible";

const SURVEY_PREFIX = "AUDIO_ACCESS:";

const SURVEY_VALUES: Record<AudioAccessPreference, string> = {
  audio_comfortable: `${SURVEY_PREFIX}AUDIO_COMFORTABLE`,
  text_support_preferred: `${SURVEY_PREFIX}TEXT_SUPPORT_PREFERRED`,
  text_first: `${SURVEY_PREFIX}TEXT_FIRST`,
  flexible: `${SURVEY_PREFIX}FLEXIBLE`,
};

export const AUDIO_ACCESS_OPTIONS: Array<{
  value: AudioAccessPreference;
  label: string;
}> = [
  {
    value: "audio_comfortable",
    label: "소리만으로도 내용을 편하게 이해해요",
  },
  {
    value: "text_support_preferred",
    label: "자막이나 글이 함께 있으면 더 편해요",
  },
  {
    value: "text_first",
    label: "소리보다 자막과 글을 주로 확인해요",
  },
  {
    value: "flexible",
    label: "콘텐츠와 상황에 따라 달라요",
  },
];

export function encodeAudioAccessPreference(preference: AudioAccessPreference) {
  return SURVEY_VALUES[preference];
}

export function decodeAudioAccessPreference(values: string[]) {
  const encoded = values.find((value) => value.startsWith(SURVEY_PREFIX));
  if (!encoded) return null;
  return (Object.entries(SURVEY_VALUES).find(
    ([, value]) => value === encoded,
  )?.[0] ?? null) as AudioAccessPreference | null;
}

export function withoutAudioAccessPreference(values: string[]) {
  return values.filter((value) => !value.startsWith(SURVEY_PREFIX));
}

export function prefersVisualAudioSupport(
  preference: AudioAccessPreference | null,
) {
  return preference === "text_support_preferred" || preference === "text_first";
}
