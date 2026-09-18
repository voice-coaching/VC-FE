import type { AnalysisProgress } from "./api/types";

export class AnalysisWaitTimeout extends Error {
  constructor() {
    super(
      "분석이 예상보다 오래 걸리고 있습니다. 녹음을 다시 보내지 않고 분석 상태를 다시 확인할 수 있습니다.",
    );
    this.name = "AnalysisWaitTimeout";
  }
}

export class AnalysisFailed extends Error {}

export async function pollAnalysis({
  getStatus,
  onProgress,
  timeoutMs = 600_000,
  intervalMs = 1_000,
}: {
  getStatus: () => Promise<AnalysisProgress>;
  onProgress: (progress: number) => void;
  timeoutMs?: number;
  intervalMs?: number;
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let status: AnalysisProgress;
    try {
      status = await Promise.race([
        getStatus(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new AnalysisWaitTimeout()),
            Math.max(0, deadline - Date.now()),
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
    onProgress(status.progressPercent);
    if (status.status === "COMPLETED") return status.analysisId;
    if (status.status === "FAILED") {
      throw new AnalysisFailed(
        status.failureReason || "음성 분석에 실패했습니다.",
      );
    }
    if (Date.now() >= deadline) throw new AnalysisWaitTimeout();
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.min(intervalMs, Math.max(0, deadline - Date.now())),
      ),
    );
  }
  throw new AnalysisWaitTimeout();
}
