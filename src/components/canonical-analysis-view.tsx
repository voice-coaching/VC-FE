import {
  canonicalAttemptKey,
  canonicalCandidateKey,
  readCanonicalAnalysisView,
  type CanonicalAnalysisView as CanonicalProjection,
  type CanonicalDecisionStatus,
  type CanonicalViewIdentity,
} from "@/lib/canonical-analysis";

const decisionLabels: Record<CanonicalDecisionStatus, string> = {
  ACCEPT: "입력 판정: 분석 진행 허용",
  REJECT: "입력 판정: 재확인 필요",
  INCONCLUSIVE: "입력 판정: 판단 보류",
  SYSTEM_FAILURE: "입력 판정: 시스템 실패",
};
const decisionDescriptions: Record<CanonicalDecisionStatus, string> = {
  ACCEPT:
    "분석을 진행할 수 있는 입력이라는 뜻이에요. 발음의 정확도나 합격 판정은 아니에요.",
  REJECT:
    "이번 입력은 분석 조건을 충족하지 못했어요. 안내를 확인한 뒤 새 녹음으로 진행해 주세요.",
  INCONCLUSIVE:
    "현재 근거로는 판단을 확정할 수 없어요. 사용자의 발음 오류를 뜻하지 않아요.",
  SYSTEM_FAILURE:
    "분석 시스템에서 문제가 발생했어요. 발음에 대한 결론으로 해석하지 마세요.",
};
const jobLabels = {
  PENDING: "분석 대기 중",
  PROCESSING: "분석 처리 중",
  COMPLETED: "분석 처리 완료",
  FAILED: "분석 처리 실패",
};
const generationLabels = {
  SCHEMA_AND_STRUCTURAL_SEMANTICS_VALID: "생성된 연습 안내",
  DETERMINISTIC_FALLBACK: "근거에 연결된 기본 연습 안내",
  NOT_DISPATCHED: "연습 안내 생성 없음",
};
const roles = { onset: "초성", nucleus: "모음", coda: "종성" };

/** Display only: no fetching, mutation, media player, effect or automatic opt-in. */
export function CanonicalAnalysisView({
  data,
  currentIdentity,
}: {
  data: unknown;
  currentIdentity: CanonicalViewIdentity;
}) {
  let view: CanonicalProjection;
  try {
    view = readCanonicalAnalysisView(data, {
      analysisId: currentIdentity.analysisId,
      recordingId: currentIdentity.recordingId,
      requestId: currentIdentity.requestId,
      executionId: currentIdentity.executionId,
    });
  } catch {
    return (
      <section className="design-card" role="alert">
        결과의 형식 또는 현재 시도를 확인할 수 없어 분석 내용을 표시하지
        못했어요.
      </section>
    );
  }
  // Remount native disclosure state on request/execution changes.
  return <CanonicalResult key={canonicalAttemptKey(view)} view={view} />;
}

function CanonicalResult({ view }: { view: CanonicalProjection }) {
  const canonical = view.canonicalAnalysis;
  const coaching = canonical?.coaching;
  const selection = canonical?.selection;
  const delivered =
    view.jobStatus === "COMPLETED" &&
    canonical?.decision.status === "ACCEPT" &&
    canonical.representation === "INLINE" &&
    canonical.feedbackDeliveryAllowed;
  const actionRows = [
    [
      "분석 재시도",
      view.actions.canRetry,
      view.actions.unavailableReasonCodes.retry,
    ],
    [
      "새 녹음",
      view.actions.canRerecord,
      view.actions.unavailableReasonCodes.rerecord,
    ],
    [
      "학습 절차 완료",
      view.actions.canComplete,
      view.actions.unavailableReasonCodes.complete,
    ],
    [
      "안내 다시 생성",
      view.actions.canRegenerate,
      view.actions.unavailableReasonCodes.regenerate,
    ],
  ] as const;
  return (
    <div className="space-y-4">
      <section className="design-card space-y-3" aria-label="분석 상태">
        <h2 className="text-lg font-bold">{jobLabels[view.jobStatus]}</h2>
        <details className="break-all text-xs text-muted-foreground">
          <summary>현재 분석 시도 식별자</summary>
          <p>requestId: {view.requestId}</p>
          <p>executionId: {view.executionId}</p>
        </details>
        {canonical ? (
          <>
            <h3 className="font-semibold">
              {decisionLabels[canonical.decision.status]}
            </h3>
            <p className="text-sm leading-6">
              {decisionDescriptions[canonical.decision.status]}
            </p>
            <p className="text-sm">
              점수는 제공되지 않아요. 0점이나 만점을 뜻하지 않아요.
            </p>
            {canonical.representation === "RETAINED_ONLY" && (
              <p className="text-sm">
                분석 근거는 보존되었지만 상세 결과 전달에 실패했어요.
              </p>
            )}
            {coaching && (
              <p className="text-sm">
                {generationLabels[coaching.generationStatus]}
              </p>
            )}
            {coaching?.generationStatus === "DETERMINISTIC_FALLBACK" && (
              <p className="text-sm">
                문장 생성이 완료되지 않아 기본 연습을 제공해요.
              </p>
            )}
            {coaching?.adapterStatus === "NO_PERMITTED_COACHING_CONTENT" && (
              <p className="text-sm">
                제공 가능한 연습 항목이 없어요. 정상 발음이나 완벽한 발음이라는
                판정은 아니에요.
              </p>
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">판정·전달 상태 상세</summary>
              <div className="mt-2 space-y-1">
                <p>
                  입력 사유: {canonical.decision.reason_code ?? "제공되지 않음"}
                </p>
                <p>입력 단계: {canonical.decision.stage ?? "제공되지 않음"}</p>
                <p>분석 상태: {canonical.coreStatus}</p>
                <p>
                  연습 연결 상태: {coaching?.adapterStatus ?? "제공되지 않음"}
                </p>
                {coaching?.adapterStatus === "READY" &&
                  coaching.fallbackReason && (
                    <p>기본 연습 제공 사유: {coaching.fallbackReason}</p>
                  )}
                {coaching?.adapterStatus === "FAIL_CLOSED" && (
                  <p>연결 오류 코드: {coaching.errorCode}</p>
                )}
                <p>점수 미제공 사유: {canonical.score.reason}</p>
              </div>
            </details>
          </>
        ) : (
          <p className="text-sm leading-6">
            {view.jobStatus === "FAILED"
              ? "분석 결론이 생성되지 않았어요. 시스템 실패를 발음 문제로 해석하지 마세요."
              : "아직 입력 판정이 나오지 않았어요."}
          </p>
        )}
        {view.serviceFailure && (
          <div role="status" className="text-sm">
            <p>분석 처리 또는 결과 전달 중 문제가 발생했어요.</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">처리 실패 상세</summary>
              <p>
                {view.serviceFailure.origin} · {view.serviceFailure.code} ·{" "}
                {view.serviceFailure.stage}
              </p>
            </details>
          </div>
        )}
      </section>

      {selection?.candidates.map((candidate, i) => {
        const expression =
          delivered && coaching?.adapterStatus === "READY"
            ? coaching.items[i].expression
            : undefined;
        return (
          <section
            key={canonicalCandidateKey(view, candidate.candidateId)}
            className="design-card space-y-3"
          >
            <h3 className="font-bold">
              {i + 1}. 목표 소리 ‘{candidate.expectedPhone}’
            </h3>
            <details className="break-all text-xs text-muted-foreground">
              <summary>후보·근거 식별자</summary>
              <p>{candidate.candidateId}</p>
              <p>guidanceId: {candidate.guidance.guidanceId}</p>
              {candidate.evidenceIds.map((id) => (
                <p key={id}>{id}</p>
              ))}
            </details>
            <p className="text-sm">
              모델 관측 후보: ‘{candidate.observedCandidate}’. 실제 발음 오류나
              조음 원인이 확정된 것은 아니에요.
            </p>
            <p className="text-sm">
              G2P 소리 역할: {roles[candidate.expectedRole]}. 철자의 위치와 다를
              수 있어요.
            </p>
            {expression && (
              <div className="space-y-2 text-sm leading-6">
                <p>{expression.explanation}</p>
                <p>{expression.action}</p>
                <p>
                  <span className="font-semibold">짧게 연습하기: </span>
                  {expression.practice}
                </p>
                <p>
                  <span className="font-semibold">스스로 확인하기: </span>
                  {expression.selfCheck}
                </p>
              </div>
            )}
            {delivered && (
              <details className="text-sm">
                <summary className="cursor-pointer">
                  근거에 연결된 일반 목표 소리 연습
                </summary>
                <p>{candidate.guidance.action}</p>
                <p>{candidate.guidance.practice}</p>
                <p>{candidate.guidance.selfCheck}</p>
              </details>
            )}
            <ul className="space-y-2 text-xs text-muted-foreground">
              {candidate.facts.map((fact) => (
                <li key={canonicalCandidateKey(view, fact.evidenceId)}>
                  <p>
                    {fact.location.word} · 단어 인덱스 {fact.location.wordIndex}{" "}
                    · 소리 인덱스 {fact.expectedIndex}
                  </p>
                  <p>위치 상태: {fact.localizationStatus}</p>
                  <p>
                    MFA 소리 위치: {fact.location.phoneStartS}–
                    {fact.location.phoneEndS}초
                  </p>
                  <p>
                    MFA 단어 위치: {fact.location.wordStartS}–
                    {fact.location.wordEndS}초
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              MFA 위치는 분석용 음성의 초 단위 위치예요. 발음 속도나 조음
              지속시간의 판정은 아니에요.
            </p>
            <button
              type="button"
              disabled
              className="text-sm text-muted-foreground"
            >
              이 구간 다시 듣기 — 시간축 대응 확인 필요
            </button>
          </section>
        );
      })}
      {selection && selection.coverage.omittedCandidateIds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          선택 범위 밖 후보 {selection.coverage.omittedCandidateIds.length}개가
          있어요. 이 화면은 전체 발음의 정상 여부를 판정하지 않아요.
        </p>
      )}
      {canonical && (
        <p className="text-sm text-muted-foreground">
          입술 영상은 이번 분석에 연결되지 않았으며 입 모양 교정은 제공하지
          않아요.
        </p>
      )}
      <section className="design-card space-y-3" aria-label="가능한 작업">
        <h3 className="font-semibold">현재 가능한 작업</h3>
        <dl className="space-y-2 text-sm">
          {actionRows.map(([label, allowed, reasons]) => (
            <div key={label}>
              <dt className="inline">{label}: </dt>
              <dd className="inline">{allowed ? "가능" : "불가"}</dd>
              {!allowed && (
                <p className="text-xs text-muted-foreground">
                  사유: {reasons.join(", ")}
                </p>
              )}
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          학습 절차 완료는 점수나 합격 판정이 아니에요. 실제 실행 시에는 최신
          상태를 다시 확인해요.
        </p>
      </section>
    </div>
  );
}
