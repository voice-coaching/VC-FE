import { z } from "zod";
import { api } from "./api";
import type {
  AnalysisCapabilities,
  AnalysisConsentInput,
  ApiContract,
  Id,
} from "./api/types";
import { requireAnalysisScope } from "./api/analysis-capabilities";
import { voiceProcessingConsentInput } from "./analysis-consent";
import { assertCoachingInput } from "./coaching-usage";
import { prepareVideoForAnalysis, type LipClip } from "./lip-practice";
import { uploadRecordingWithFreshUrl } from "./recording-upload";

/** Consent is bound to the displayed server policy, never the old audio-only storage key. */
export type LipProcessingConsent = {
  voicePolicyRevision: string | null;
  videoPolicyRevision: string | null;
};

export type PreparedLipAnalysis = ReturnType<typeof prepareVideoForAnalysis> & {
  analysisConsent: AnalysisConsentInput | undefined;
  recordingConsent: {
    videoProcessingConsentAccepted?: true;
    videoProcessingConsentPolicyRevision?: string;
  };
};

export const EMPTY_LIP_CONSENT: LipProcessingConsent = {
  voicePolicyRevision: null,
  videoPolicyRevision: null,
};

const videoPolicySchema = z
  .object({
    recordingUpload: z.literal("CONFIGURED"),
    analysisRequests: z.literal("CONFIGURED"),
    supportedLearningFocuses: z
      .array(z.string())
      .refine((values) => values.includes("PRONUNCIATION")),
    acceptedVideoMimeTypes: z.array(z.string().min(1)).min(1),
    maximumVideoUploadBytes: z.number().int().positive(),
    minimumDurationMs: z.number().finite().nonnegative(),
    maximumDurationMs: z.number().finite().positive(),
    videoRequiresAudioTrack: z.boolean(),
    voiceProcessingConsentRequired: z.boolean(),
    videoProcessingConsentRequired: z.boolean(),
    consentPolicyRevision: z.string().trim().min(1).nullable(),
    videoProcessingConsentPolicyRevision: z.string().trim().min(1).nullable(),
  })
  .refine(
    (value) =>
      value.minimumDurationMs <= value.maximumDurationMs &&
      (!value.voiceProcessingConsentRequired ||
        value.consentPolicyRevision !== null) &&
      (!value.videoProcessingConsentRequired ||
        value.videoProcessingConsentPolicyRevision !== null),
  );

/** Recheck admission and uncached upload/consent policy before each upload. */
export async function loadLipAnalysisCapabilities(
  signal?: AbortSignal,
): Promise<AnalysisCapabilities> {
  await requireAnalysisScope("VIDEO", signal);
  const capabilities = await api.training.getAnalysisCapabilities(signal);
  assertLipAnalysisPolicy(capabilities);
  return capabilities;
}

export function assertLipAnalysisPolicy(
  capabilities: AnalysisCapabilities,
): void {
  if (!videoPolicySchema.safeParse(capabilities).success)
    throw new Error(
      "영상 분석 제한 및 처리 동의 정책을 확인하지 못했어요. 잠시 후 다시 확인해 주세요.",
    );
}

export function hasLipProcessingConsent(
  capabilities: AnalysisCapabilities,
  accepted: LipProcessingConsent,
): boolean {
  return (
    (!capabilities.voiceProcessingConsentRequired ||
      (capabilities.consentPolicyRevision !== null &&
        accepted.voicePolicyRevision === capabilities.consentPolicyRevision)) &&
    (!capabilities.videoProcessingConsentRequired ||
      (capabilities.videoProcessingConsentPolicyRevision !== null &&
        accepted.videoPolicyRevision ===
          capabilities.videoProcessingConsentPolicyRevision))
  );
}

/** Validate before creating server resources; video bytes remain a single audiovisual recording. */
export function prepareLipAnalysis(
  clip: LipClip,
  script: string,
  capabilities: AnalysisCapabilities,
  accepted: LipProcessingConsent,
): PreparedLipAnalysis {
  assertLipAnalysisPolicy(capabilities);
  assertCoachingInput(script, clip.durationMs);
  if (!hasLipProcessingConsent(capabilities, accepted))
    throw new Error(
      "현재 정책의 음성·영상 처리 안내를 확인하고 필요한 항목에 동의해 주세요.",
    );
  if (
    clip.durationMs < capabilities.minimumDurationMs ||
    clip.durationMs > capabilities.maximumDurationMs
  )
    throw new Error(
      `영상은 ${Math.ceil(capabilities.minimumDurationMs / 1000)}초 이상 ${Math.floor(capabilities.maximumDurationMs / 1000)}초 이내여야 해요.`,
    );
  if (capabilities.videoRequiresAudioTrack && !clip.hasAudioTrack)
    throw new Error(
      "영상에 마이크 음성이 필요해요. 마이크를 켜고 다시 촬영해 주세요.",
    );
  const prepared = prepareVideoForAnalysis(
    clip.blob,
    capabilities.acceptedVideoMimeTypes,
  );
  if (
    !prepared.blob.size ||
    prepared.blob.size > capabilities.maximumVideoUploadBytes
  )
    throw new Error("촬영 영상이 비어 있거나 서버의 업로드 제한을 초과했어요.");
  return {
    ...prepared,
    analysisConsent: voiceProcessingConsentInput(capabilities),
    recordingConsent: capabilities.videoProcessingConsentRequired
      ? {
          videoProcessingConsentAccepted: true as const,
          videoProcessingConsentPolicyRevision:
            capabilities.videoProcessingConsentPolicyRevision!,
        }
      : {},
  };
}

/** Register/select only the uploaded video's ID. The backend owns decoding and quality checks. */
export async function uploadLipRecording(
  options: {
    sessionId: Id;
    clip: LipClip;
    prepared: PreparedLipAnalysis;
    signal: AbortSignal;
    requireActive: () => void;
    onProgress: (value: number) => void;
  },
  training: ApiContract["training"] = api.training,
): Promise<Id> {
  const { sessionId, clip, prepared, signal, requireActive, onProgress } =
    options;
  const uploadInput = {
    fileName: `lip-practice-${Date.now()}.${prepared.extension}`,
    mimeType: prepared.mimeType,
    fileSizeBytes: prepared.blob.size,
  };
  requireActive();
  const uploadInfo = await uploadRecordingWithFreshUrl({
    issueUploadUrl: () => {
      requireActive();
      return training.getUploadUrl(sessionId, uploadInput);
    },
    upload: (currentUpload) => {
      requireActive();
      return training.uploadRecording(
        currentUpload,
        prepared.blob,
        onProgress,
        signal,
      );
    },
    onRetry: () => {
      requireActive();
      onProgress(0);
    },
  });
  requireActive();
  const recording = await training.registerRecording(sessionId, {
    objectKey: uploadInfo.objectKey,
    mimeType: prepared.mimeType,
    fileSizeBytes: prepared.blob.size,
    durationMs: clip.durationMs,
    ...prepared.recordingConsent,
  });
  requireActive();
  const recordingId = recording.recordingId ?? recording.id;
  if (recordingId == null) throw new Error("영상 녹화 ID가 없습니다.");
  // The public recording DTO calls video+audio AUDIO_VISUAL, not the capability's VIDEO scope.
  if (recording.analysisMediaType !== "AUDIO_VISUAL")
    throw new Error(
      "서버가 촬영본을 영상으로 등록하지 못했어요. 분석을 요청하지 않았습니다.",
    );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    requireActive();
    const recordings = await training.listRecordings(sessionId);
    requireActive();
    const current = recordings.find(
      (item) => String(item.recordingId ?? item.id) === String(recordingId),
    );
    if (
      current?.analysisMediaType &&
      current.analysisMediaType !== "AUDIO_VISUAL"
    )
      throw new Error(
        "서버의 영상 등록 상태가 변경됐어요. 분석을 요청하지 않았습니다.",
      );
    if (current?.qualityStatus === "PASS") {
      await training.selectRecording(sessionId, recordingId);
      requireActive();
      return recordingId;
    }
    if (current && current.qualityStatus !== "PENDING")
      throw new Error(
        `영상과 내장 음성의 품질을 확인해 주세요: ${current.qualityStatus}`,
      );
    if (attempt < 29) await waitForVideoQuality(signal);
  }
  throw new Error(
    "영상 품질 확인이 지연되고 있어요. 학습 기록에서 상태를 확인해 주세요.",
  );
}

function waitForVideoQuality(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("영상 분석 대기를 취소했습니다.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, 1000);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
