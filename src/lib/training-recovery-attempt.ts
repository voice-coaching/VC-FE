import { api } from "./api";
import { CANONICAL_RESULT_HEADER } from "./api/canonical";
import type {
  ApiContract,
  Id,
  AnalysisConsentInput,
  AnalysisProgress,
  RecordingUploadUrl,
} from "./api/types";
import { ApiError, getAuthSessionVersion } from "./api/client";
import {
  loadTrainingRecovery,
  type TrainingRecovery,
} from "./api/training-recovery";
import {
  practiceRecoveryStore,
  type RecoveryStore,
} from "./practice-recovery-store";

type SessionInput = Parameters<ApiContract["training"]["create"]>[0];
type Registration = Parameters<ApiContract["training"]["registerRecording"]>[1];
type Source = {
  blob: Blob;
  original: Blob;
  durationMs: number;
  mimeType: string;
  extension: string;
};
type Command = {
  key: string;
  body?: AnalysisConsentInput;
  retry: boolean;
  acknowledged: boolean;
};
export type TrainingAttemptRecord = {
  version: 1;
  resultSchema: string;
  userId: string;
  scope: string;
  attemptId: string;
  context: string;
  source?: Source;
  sessionInput: SessionInput;
  sessionId?: Id;
  recordingId?: Id;
  analysisId?: Id;
  keys: {
    session: string;
    upload: string;
    registration: string;
    analysis: string;
  };
  uploadInput?: { fileName: string; mimeType: string; fileSizeBytes: number };
  objectKey?: string;
  registration?: Registration;
  command?: Command;
};
type Dependencies = {
  api: Pick<ApiContract, "training">;
  recovery: (sessionId: Id) => Promise<TrainingRecovery>;
  store: RecoveryStore;
};
const defaults: Dependencies = {
  api,
  recovery: loadTrainingRecovery,
  store: practiceRecoveryStore,
};
function failure(code: string, message: string): never {
  throw new ApiError(message, 409, code);
}
function requireEpoch(epoch: number): void {
  if (epoch !== getAuthSessionVersion())
    throw new ApiError(
      "로그인 정보가 변경되어 복구를 중단했습니다.",
      499,
      "AUTH_SESSION_CHANGED",
    );
}

/** Durable identity for one captured recording. Reads precede retransmission; only explicit retry creates a retry key. */
export class TrainingRecoveryAttempt {
  private readonly epoch = getAuthSessionVersion();
  private busy?: Promise<unknown>;
  private constructor(
    public record: TrainingAttemptRecord,
    private readonly dependencies: Dependencies,
  ) {}

  static async restore(
    userId: string,
    scope: string,
    context: string,
    dependencies = defaults,
  ): Promise<TrainingRecoveryAttempt | null> {
    const epoch = getAuthSessionVersion();
    const record = await dependencies.store.read<TrainingAttemptRecord>(
      userId,
      scope,
    );
    requireEpoch(epoch);
    if (!record) return null;
    if (
      record.version !== 1 ||
      record.resultSchema !== CANONICAL_RESULT_HEADER ||
      record.userId !== userId ||
      record.scope !== scope ||
      record.context !== context
    )
      failure(
        "CANONICAL_ATTEMPT_CHANGED",
        "보관한 녹음과 현재 연습의 원문·시도가 다릅니다. 기존 기록을 확인해 주세요.",
      );
    return new TrainingRecoveryAttempt(record, dependencies);
  }

  static async open(
    input: {
      userId: string;
      scope: string;
      context: string;
      sessionInput: SessionInput;
      source?: Source;
      sessionId?: Id;
      recordingId?: Id;
    },
    dependencies = defaults,
  ): Promise<TrainingRecoveryAttempt> {
    const epoch = getAuthSessionVersion();
    const initialize = async () => {
      requireEpoch(epoch);
      const restored = await this.restore(
        input.userId,
        input.scope,
        input.context,
        dependencies,
      );
      requireEpoch(epoch);
      if (restored) return restored;
      const uuid = () => crypto.randomUUID();
      const record: TrainingAttemptRecord = {
        version: 1,
        resultSchema: CANONICAL_RESULT_HEADER,
        userId: input.userId,
        scope: input.scope,
        context: input.context,
        attemptId: uuid(),
        sessionInput: structuredClone(input.sessionInput),
        source: input.source,
        sessionId: input.sessionId,
        recordingId: input.recordingId,
        keys: {
          session: uuid(),
          upload: uuid(),
          registration: uuid(),
          analysis: uuid(),
        },
      };
      if (input.source)
        record.uploadInput = {
          fileName: `recording-${record.attemptId}.${input.source.extension}`,
          mimeType: input.source.mimeType,
          fileSizeBytes: input.source.blob.size,
        };
      const attempt = new TrainingRecoveryAttempt(record, dependencies);
      await attempt.persist();
      return attempt;
    };
    return typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request(
          `practice-recovery:${input.userId}:${input.scope}`,
          initialize,
        )
      : initialize();
  }

  private active(): void {
    if (this.epoch !== getAuthSessionVersion())
      throw new ApiError(
        "로그인 정보가 변경되어 복구를 중단했습니다.",
        499,
        "AUTH_SESSION_CHANGED",
      );
  }
  private async persist(): Promise<void> {
    this.active();
    await this.dependencies.store.write(
      this.record.userId,
      this.record.scope,
      this.record,
    );
    this.active();
  }
  private async snapshot(): Promise<TrainingRecovery> {
    this.active();
    const snapshot = await this.dependencies.recovery(this.record.sessionId!);
    this.active();
    if (String(snapshot.sessionId) !== String(this.record.sessionId))
      failure("CANONICAL_ATTEMPT_CHANGED", "복구할 세션이 변경되었습니다.");
    return snapshot;
  }
  async inspect(): Promise<TrainingRecovery> {
    return this.snapshot();
  }
  private async serialized<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.busy;
    const run = async () => {
      const latest = await this.dependencies.store.read<TrainingAttemptRecord>(
        this.record.userId,
        this.record.scope,
      );
      this.active();
      if (latest?.attemptId !== this.record.attemptId)
        failure(
          "CANONICAL_ATTEMPT_CHANGED",
          "다른 연습 시도로 변경되었습니다.",
        );
      this.record = latest;
      return action();
    };
    const pending = Promise.resolve(previous)
      .catch(() => undefined)
      .then(async () => {
        if (typeof navigator !== "undefined" && navigator.locks)
          return await navigator.locks.request(
            `practice-recovery:${this.record.userId}:${this.record.scope}`,
            run,
          );
        return await run();
      });
    this.busy = pending;
    try {
      return await pending;
    } finally {
      if (this.busy === pending) this.busy = undefined;
    }
  }

  async prepareRecording(
    onProgress?: (percent: number) => void,
  ): Promise<{ sessionId: Id; recordingId: Id }> {
    return this.serialized(async () => {
      const training = this.dependencies.api.training;
      if (this.record.sessionId == null) {
        await this.persist();
        const session = await training.create(
          this.record.sessionInput,
          this.record.keys.session,
        );
        this.active();
        this.record.sessionId = session.sessionId ?? session.id;
        if (this.record.sessionId == null)
          throw new Error("세션 번호를 확인하지 못했습니다.");
        await this.persist();
      }
      const sessionId = this.record.sessionId;
      let uploadInfo: RecordingUploadUrl | undefined;
      const issue = async () => {
        if (!this.record.uploadInput)
          failure(
            "RECOVERY_FILE_UNAVAILABLE",
            "이 기기에 원본 녹음이 없습니다. 재녹음이 필요합니다.",
          );
        await this.persist();
        const issued = await training.getUploadUrl(
          sessionId,
          this.record.uploadInput,
          this.record.keys.upload,
        );
        this.active();
        if (this.record.objectKey && this.record.objectKey !== issued.objectKey)
          failure("CANONICAL_ATTEMPT_CHANGED", "업로드 객체가 변경되었습니다.");
        this.record.objectKey = issued.objectKey;
        await this.persist();
        return issued;
      };
      for (let rotation = 0; rotation < 3; rotation++) {
        const snapshot = await this.snapshot();
        if (
          this.record.command &&
          this.record.recordingId != null &&
          String(snapshot.selectedRecordingId) !==
            String(this.record.recordingId)
        )
          failure(
            "CANONICAL_ATTEMPT_CHANGED",
            "선택한 녹음이 변경되어 기존 시도의 복구를 중단했습니다.",
          );
        const upload = snapshot.uploads.find(
          (item) => item.objectKey === this.record.objectKey,
        );
        if (upload?.status === "RECORDING_UNAVAILABLE")
          failure(
            "RECORDING_UNAVAILABLE",
            "기존 녹음 연결을 복구할 수 없습니다. 새 분석을 자동 요청하지 않았습니다.",
          );
        if (upload?.status === "REGISTERED") {
          if (upload.recordingId == null)
            failure("RECORDING_UNAVAILABLE", "등록된 녹음 번호가 없습니다.");
          this.record.recordingId = upload.recordingId;
        }
        if (this.record.recordingId != null) {
          const recordings = await training.listRecordings(sessionId);
          this.active();
          if (
            !recordings.some(
              (item) =>
                String(item.recordingId ?? item.id) ===
                String(this.record.recordingId),
            )
          )
            failure(
              "RECORDING_UNAVAILABLE",
              "기존 녹음이 삭제되었거나 사용할 수 없습니다.",
            );
          await this.persist();
          return { sessionId, recordingId: this.record.recordingId };
        }
        if (upload?.status === "EXPIRED") {
          this.requireFile();
          this.record.keys.upload = crypto.randomUUID();
          this.record.keys.registration = crypto.randomUUID();
          delete this.record.objectKey;
          delete this.record.registration;
          uploadInfo = undefined;
          await this.persist();
          continue;
        }
        if (!upload) {
          // A truncated list never proves absence. Replay the exact issuance/registration command.
          try {
            uploadInfo = await issue();
          } catch (error) {
            if (!(
              error instanceof ApiError &&
              error.code === "UPLOAD_INTENT_NOT_ACTIVE"
            ))
              throw error;
            if (this.record.registration) {
              const registered = await training.registerRecording(
                sessionId,
                this.record.registration,
                this.record.keys.registration,
              );
              this.active();
              this.record.recordingId = registered.recordingId ?? registered.id;
              await this.persist();
              continue;
            }
            if (this.record.objectKey) throw error;
            // An issuance response was lost and no object key/PUT was ever acknowledged locally.
            this.requireFile();
            this.record.keys.upload = crypto.randomUUID();
            await this.persist();
          }
          if (
            snapshot.hasMoreUploads &&
            this.record.objectKey &&
            this.record.source &&
            this.record.uploadInput
          ) {
            this.record.registration ??= {
              objectKey: this.record.objectKey,
              mimeType: this.record.uploadInput.mimeType,
              fileSizeBytes: this.record.uploadInput.fileSizeBytes,
              durationMs: this.record.source.durationMs,
            };
            await this.persist();
            const registered = await training.registerRecording(
              sessionId,
              this.record.registration,
              this.record.keys.registration,
            );
            this.active();
            this.record.recordingId = registered.recordingId ?? registered.id;
            await this.persist();
          }
          continue;
        }
        if (
          upload.mimeType !== this.record.uploadInput?.mimeType ||
          upload.fileSizeBytes !== this.record.uploadInput?.fileSizeBytes
        )
          failure(
            "ANALYSIS_SOURCE_NOT_READY",
            "복구 파일의 형식 또는 크기가 일치하지 않습니다.",
          );
        if (upload.status === "UPLOAD_REQUIRED") {
          const source = this.requireFile();
          uploadInfo ??= await issue();
          await training.uploadRecording(uploadInfo, source.blob, onProgress);
          this.active();
        }
        const durationMs = this.record.source?.durationMs;
        if (durationMs == null)
          failure(
            "RECOVERY_FILE_UNAVAILABLE",
            "녹음 길이를 복구하지 못했습니다.",
          );
        this.record.registration ??= {
          objectKey: upload.objectKey,
          mimeType: upload.mimeType,
          fileSizeBytes: upload.fileSizeBytes,
          durationMs,
        };
        await this.persist();
        const registered = await training.registerRecording(
          sessionId,
          this.record.registration,
          this.record.keys.registration,
        );
        this.active();
        this.record.recordingId = registered.recordingId ?? registered.id;
        if (this.record.recordingId == null)
          throw new Error("녹음 번호를 확인하지 못했습니다.");
        await this.persist();
        return { sessionId, recordingId: this.record.recordingId };
      }
      failure(
        "RECOVERY_UPLOAD_UNAVAILABLE",
        "업로드 정보를 다시 확인해 주세요. 새 분석은 요청하지 않았습니다.",
      );
    });
  }

  private requireFile(): Source {
    if (!this.record.source?.blob?.size)
      failure(
        "RECOVERY_FILE_UNAVAILABLE",
        "이 기기에 원본 녹음이 없습니다. 재녹음이 필요합니다.",
      );
    return this.record.source;
  }

  async admission(
    consent?: AnalysisConsentInput,
    explicitRetry = false,
  ): Promise<AnalysisProgress> {
    return this.serialized(async () => {
      let snapshot = await this.snapshot();
      if (
        String(snapshot.selectedRecordingId) !== String(this.record.recordingId)
      )
        failure(
          "CANONICAL_ATTEMPT_CHANGED",
          "선택한 녹음이 변경되어 복구를 중단했습니다.",
        );
      const pendingRetry =
        this.record.command?.retry && !this.record.command.acknowledged;
      if (
        snapshot.analysis &&
        !pendingRetry &&
        this.record.analysisId != null &&
        String(this.record.analysisId) !== String(snapshot.analysis.analysisId)
      )
        failure(
          "CANONICAL_ATTEMPT_CHANGED",
          "분석 시도가 변경되어 복구를 중단했습니다.",
        );
      if (
        snapshot.analysis &&
        !pendingRetry &&
        (!explicitRetry || snapshot.analysis.status !== "FAILED")
      ) {
        this.record.analysisId = snapshot.analysis.analysisId;
        await this.persist();
        return snapshot.analysis;
      }
      if (explicitRetry && !pendingRetry) {
        if (snapshot.analysis?.status !== "FAILED")
          failure(
            "ANALYSIS_NOT_FAILED",
            "실패한 분석만 명시적으로 재시도할 수 있습니다.",
          );
        this.record.command = {
          key: crypto.randomUUID(),
          body: structuredClone(consent),
          retry: true,
          acknowledged: false,
        };
      }
      if (!this.record.command)
        this.record.command = {
          key: this.record.keys.analysis,
          body: structuredClone(consent),
          retry: false,
          acknowledged: false,
        };
      const command = this.record.command;
      // A replayed receipt may say PENDING even after completion. Always read recovery afterwards.
      await this.persist();
      try {
        const receipt = command.retry
          ? await this.dependencies.api.training.retryAnalysis(
              this.record.sessionId!,
              command.body,
              undefined,
              command.key,
            )
          : await this.dependencies.api.training.analyze(
              this.record.sessionId!,
              command.body,
              command.key,
            );
        this.active();
        this.record.analysisId = receipt.analysisId;
        command.acknowledged = true;
        await this.persist();
      } catch (error) {
        if (!(
          error instanceof ApiError &&
          ["ANALYSIS_ALREADY_RUNNING", "ANALYSIS_ALREADY_REQUESTED"].includes(
            error.code,
          )
        ))
          throw error;
      }
      snapshot = await this.snapshot();
      if (
        !snapshot.analysis ||
        String(snapshot.selectedRecordingId) !== String(this.record.recordingId)
      )
        failure(
          "CANONICAL_ATTEMPT_CHANGED",
          "접수된 분석 상태를 확인하지 못했습니다. 같은 작업을 다시 확인해 주세요.",
        );
      if (
        this.record.analysisId != null &&
        String(this.record.analysisId) !== String(snapshot.analysis.analysisId)
      )
        failure("CANONICAL_ATTEMPT_CHANGED", "분석 시도가 변경되었습니다.");
      this.record.analysisId = snapshot.analysis.analysisId;
      await this.persist();
      return snapshot.analysis;
    });
  }
}
