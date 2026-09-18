import { AnalysisFailed, AnalysisWaitTimeout } from "./analysis-polling";
import { ApiError } from "./api/client";

export type PracticeErrorKind =
  "quality" | "input" | "unsupported" | "preparation";

export class PracticeInputError extends Error {
  constructor(
    public readonly kind: PracticeErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "PracticeInputError";
  }
}

export function describePracticeError(
  reason: unknown,
  recorderStatus?: string,
) {
  if (reason instanceof AnalysisWaitTimeout) {
    return {
      kind: "waiting",
      title: "분석 결과를 기다리고 있어요",
      hint: "서버에서 분석이 계속될 수 있어요. 기존 분석 상태를 다시 확인해 주세요.",
    };
  }
  if (reason instanceof AnalysisFailed) {
    return {
      kind: "analysis",
      title: "AI 분석을 완료하지 못했어요",
      hint: "아래 실패 사유를 확인하고 분석을 다시 시도해 주세요.",
    };
  }
  if (reason instanceof ApiError) {
    if (reason.status === 401 || reason.status === 403) {
      return {
        kind: "auth",
        title: "로그인 상태를 확인해 주세요",
        hint: "로그인 또는 접근 권한을 확인한 뒤 다시 시도해 주세요.",
      };
    }
    if (reason.status === 0 || reason.status === 408) {
      return {
        kind: "network",
        title: "서버 응답을 확인하지 못했어요",
        hint: "연결 상태를 확인해 주세요. 이미 접수된 분석은 상태를 다시 조회할 수 있어요.",
      };
    }
    return {
      kind: "server",
      title: "요청을 처리하지 못했어요",
      hint: "아래 서버 응답을 확인해 주세요.",
    };
  }
  if (reason instanceof PracticeInputError) {
    const messages = {
      quality: [
        "녹음이 음질 검사를 통과하지 못했어요",
        "아래 내용을 확인하고 다시 녹음해 주세요.",
      ],
      input: [
        "녹음 조건을 확인해 주세요",
        "아래 길이·파일 조건에 맞게 다시 녹음해 주세요.",
      ],
      unsupported: [
        "현재 지원하지 않는 연습이에요",
        "지원되는 연습 유형과 서버 설정을 확인해 주세요.",
      ],
      preparation: [
        "녹음 파일을 준비하지 못했어요",
        "파일 변환 또는 음질 검사 처리 상태를 확인해 주세요.",
      ],
    };
    const [title, hint] = messages[reason.kind];
    return { kind: reason.kind, title, hint };
  }
  if (recorderStatus === "denied") {
    return {
      kind: "recording",
      title: "마이크 권한이 필요해요",
      hint: "브라우저에서 마이크 권한을 허용해 주세요.",
    };
  }
  if (recorderStatus === "error" || recorderStatus === "unsupported") {
    return {
      kind: "recording",
      title: "녹음을 시작하지 못했어요",
      hint: "브라우저의 녹음 지원과 마이크 상태를 확인해 주세요.",
    };
  }
  return {
    kind: "unknown",
    title: "요청을 완료하지 못했어요",
    hint: "아래 오류 내용을 확인하고 다시 시도해 주세요.",
  };
}
