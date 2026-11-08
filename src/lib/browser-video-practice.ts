import { api, type Id } from "./api";
import { ApiError, getAuthSessionVersion } from "./api/client";
import {
  BrowserVideoClient,
  browserVideoSha256,
  videoTerminal,
  type BrowserVideoJob,
  type BrowserVideoResult,
} from "./api/browser-video";
import { prepareVideoForAnalysis, type LipClip } from "./lip-practice";
import { practiceRecoveryStore } from "./practice-recovery-store";
import { getAuthenticatedUserId } from "./auth-session";
type SavedVideoAttempt = {
  version: 1;
  clientRequestId: string;
  sessionKey: string;
  clip: Omit<LipClip, "url">;
  scriptText: string;
  title: string;
  contentId?: Id;
  sessionId?: Id;
  job?: { jobId: string; executionId: string; sequence: number };
};

type Progress = {
  signal: AbortSignal;
  onPhase: (phase: "preparing" | "uploading" | "analyzing") => void;
  onJob: (job: BrowserVideoJob) => void;
};

/** One immutable clip/UUID. Rechecking a failed connection resumes this attempt, never fresh inference. */
export class BrowserVideoPracticeAttempt {
  readonly clientRequestId: string;
  private readonly sessionKey: string;
  private readonly userId = getAuthenticatedUserId();
  private job?: SavedVideoAttempt["job"];
  private readonly epoch = getAuthSessionVersion();
  private contentId?: Id;
  private sessionId?: Id;
  private client?: BrowserVideoClient;
  private result?: BrowserVideoResult;
  constructor(
    readonly clip: LipClip,
    private readonly scriptText: string,
    private readonly title: string,
    private readonly scope: string,
    saved?: SavedVideoAttempt,
  ) {
    this.clientRequestId = saved?.clientRequestId ?? crypto.randomUUID();
    this.sessionKey = saved?.sessionKey ?? crypto.randomUUID();
    this.contentId = saved?.contentId;
    this.sessionId = saved?.sessionId;
    this.job = saved?.job;
  }

  static async restore(
    scope: string,
    scriptText: string,
  ): Promise<BrowserVideoPracticeAttempt | null> {
    const userId = getAuthenticatedUserId();
    if (!userId) return null;
    const saved = await practiceRecoveryStore.read<SavedVideoAttempt>(
      String(userId),
      scope,
    );
    if (!saved) return null;
    if (saved.version !== 1 || saved.scriptText !== scriptText)
      throw new Error(
        "보관한 영상과 현재 연습 문장이 다릅니다. 기존 작업을 확인해 주세요.",
      );
    const clip = { ...saved.clip, url: URL.createObjectURL(saved.clip.blob) };
    return new BrowserVideoPracticeAttempt(
      clip,
      saved.scriptText,
      saved.title,
      scope,
      saved,
    );
  }

  async saveCapture(): Promise<void> {
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.userId || this.epoch !== getAuthSessionVersion())
      throw new Error("로그인 정보가 변경되어 영상 복구를 중단했습니다.");
    const { url: _url, ...clip } = this.clip;
    await practiceRecoveryStore.write<SavedVideoAttempt>(
      String(this.userId),
      this.scope,
      {
        version: 1,
        clientRequestId: this.clientRequestId,
        sessionKey: this.sessionKey,
        clip,
        scriptText: this.scriptText,
        title: this.title,
        contentId: this.contentId,
        sessionId: this.sessionId,
        job: this.job,
      },
    );
    if (this.epoch !== getAuthSessionVersion())
      throw new Error("로그인 정보가 변경되었습니다.");
  }

  async run(
    consented: boolean,
    progress: Progress,
  ): Promise<BrowserVideoResult> {
    const { signal, onPhase } = progress;
    const onJob = async (job: BrowserVideoJob) => {
      this.job = {
        jobId: job.jobId,
        executionId: job.executionId,
        sequence: job.sequence,
      };
      await this.persist();
      progress.onJob(job);
    };
    const active = () => {
      if (signal.aborted || this.epoch !== getAuthSessionVersion())
        throw new DOMException("영상 분석 대기를 중단했습니다.", "AbortError");
    };
    active();
    if (!consented)
      throw new Error("원본 영상과 내장 음성의 AI 전송·분석에 동의해 주세요.");
    if (this.result) return this.result;
    if (
      !this.clip.hasAudioTrack ||
      this.clip.durationMs < 500 ||
      this.clip.durationMs > 120000
    )
      throw new Error("음성이 포함된 0.5~120초 영상을 촬영해 주세요.");
    const source = prepareVideoForAnalysis(this.clip.blob, [
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ]);
    if (!source.blob.size || source.blob.size > 256 * 1024 * 1024)
      throw new Error("촬영 영상은 256 MiB 이하여야 해요.");
    await this.persist();
    active();
    onPhase("preparing");
    if (!this.client) {
      const bytes = await source.blob.arrayBuffer();
      active();
      const sha256 = await browserVideoSha256(bytes);
      active();
      if (this.contentId === undefined) {
        const content = await api.content.createCustom(
          {
            title: this.title,
            scriptText: this.scriptText,
            learningFocus: "PRONUNCIATION",
            retention: "SESSION_HISTORY",
            locale: "ko-KR",
          },
          this.clientRequestId,
        );
        active();
        this.contentId = content.id;
        await this.persist();
      }
      if (this.sessionId === undefined) {
        const session = await api.training.create(
          {
            contentId: this.contentId,
            learningFocus: "PRONUNCIATION",
          },
          this.sessionKey,
        );
        active();
        this.sessionId = session.sessionId ?? session.id;
        if (this.sessionId == null)
          throw new Error("영상 업로드 권한의 학습 세션을 만들지 못했어요.");
        await this.persist();
      }
      this.client = new BrowserVideoClient(
        {
          sessionId: this.sessionId,
          clientRequestId: this.clientRequestId,
          source: {
            sha256,
            fileSizeBytes: source.blob.size,
            mimeType: source.mimeType as
              "video/mp4" | "video/webm" | "video/quicktime",
          },
          scriptText: this.scriptText,
          contentId: this.contentId,
        },
        this.job,
      );
    }
    const client = this.client;
    let job = await client.find(signal);
    active();
    if (!job) {
      job = await client.create(signal);
      active();
    }
    await onJob(job);
    if (job.status === "AWAITING_MEDIA") {
      if (!job.uploaded.includes("source")) {
        onPhase("uploading");
        job = await client.upload(job.jobId, source.blob, signal);
        active();
        await onJob(job);
      }
      if (job.status === "AWAITING_MEDIA") {
        job = await client.start(job.jobId, signal);
        active();
        await onJob(job);
      }
    }
    onPhase("analyzing");
    const deadline = performance.now() + 20 * 60 * 1000;
    let failures = 0;
    while (!videoTerminal(job)) {
      if (performance.now() > deadline)
        throw new Error(
          "분석 대기 시간이 길어지고 있어요. 같은 촬영본의 처리 상태를 다시 확인해 주세요.",
        );
      await pause(3000, signal);
      active();
      try {
        job = await client.status(job.jobId, signal);
        active();
        await onJob(job);
        failures = 0;
      } catch (error) {
        active();
        // Retry reads only, with a finite bound. Input/auth/identity errors never create a new job.
        if (
          !(error instanceof ApiError) ||
          ![0, 408, 429, 500, 502, 503, 504].includes(error.status) ||
          ++failures > 5
        )
          throw error;
        if (error.code.includes("MISMATCH") || error.code.includes("INVALID"))
          throw error;
        await pause(
          Math.max(
            error.retryAfterMs ?? 0,
            Math.min(30000, 1000 * 2 ** failures),
          ),
          signal,
        );
      }
    }
    if (!job.resultAvailable) {
      const messages: Record<string, string> = {
        MEDIA_NORMALIZATION_FAILED:
          "영상과 내장 음성을 읽지 못했어요. 카메라·마이크를 확인하고 다시 촬영해 주세요.",
        EXECUTION_INTERRUPTED:
          "AI 분석이 중단됐어요. 같은 작업을 자동으로 재실행하지 않았습니다.",
        UPLOAD_EXPIRED:
          "영상 업로드 대기 시간이 만료됐어요. 다시 촬영해 주세요.",
      };
      throw new Error(
        messages[job.failure?.code ?? ""] ??
          (job.status === "CANCELLED"
            ? "영상 분석이 취소됐어요."
            : "AI 영상 분석이 실패했어요. 다시 촬영해 주세요."),
      );
    }
    this.result = await client.result(job, signal);
    active();
    return this.result;
  }
}

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("영상 분석 대기를 중단했습니다.", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}
