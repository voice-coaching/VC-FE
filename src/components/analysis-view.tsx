"use client";

import Image from "next/image";
import { PhoneDifference } from "./phone-difference";
import * as Dialog from "@radix-ui/react-dialog";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { ReferencePlayer } from "@/components/reference-player";
import { GuidePlayer } from "@/components/guide-player";
import { AnalysisSummary } from "@/components/analysis-summary";
import { CanonicalLipResult } from "@/components/canonical-lip-result";
import { visibleAnalysisScoreGroups } from "@/lib/analysis-feedback";
import { canonicalCriterionPoints } from "@/lib/canonical-score";
import {
  CorrectionComparison,
  type ReportCorrection,
} from "@/components/report-correction";
import { ReportScore } from "@/components/report-score";
import styles from "./report-design.module.css";
import type { DirectResult } from "@/lib/direct-analysis";
import type {
  AnalysisResult,
  AnalysisSegment,
  Id,
  PracticeContent,
} from "@/lib/api";

function segmentText(segment: AnalysisSegment) {
  return segment.expectedText?.trim() || `문장 ${segment.sequenceNo}`;
}

function ReportIcon({
  name,
  size = 18,
}: {
  name: "warning" | "check" | "info";
  size?: number;
}) {
  return (
    <Image
      src={`/figma/report/${name}.svg`}
      alt=""
      width={size}
      height={size}
    />
  );
}

export type AnalysisViewContent = Pick<
  PracticeContent,
  "id" | "contentType" | "title" | "scriptText" | "referenceAudioAvailable"
>;

export type PronunciationDetail = {
  word: string;
  observed: string;
  expected: string;
  feedback: string;
  tip?: string;
};

export function AnalysisView({
  analysis,
  segments,
  content,
  recordingUrl,
  recordingId,
  isCameraPractice = false,
  reportParameter = "report",
  corrections,
  practiceResult,
  practiceDecisionStatus,
  sentenceMode = false,
  pronunciationDetails = {},
}: {
  analysis: AnalysisResult;
  segments: AnalysisSegment[];
  content: AnalysisViewContent;
  recordingUrl?: string;
  recordingId?: Id;
  courseMode?: boolean;
  isCameraPractice?: boolean;
  reportParameter?: string;
  corrections?: ReportCorrection[];
  practiceResult?: DirectResult["practiceResult"];
  practiceDecisionStatus?: string;
  sentenceMode?: boolean;
  pronunciationDetails?: Record<string, PronunciationDetail[]>;
}) {
  const canonicalCore = analysis.canonical?.canonicalAnalysis;
  const reviewItems =
    corrections ??
    (canonicalCore?.feedbackDeliveryAllowed &&
    canonicalCore.coaching?.adapterStatus === "READY"
      ? canonicalCore.coaching.items
      : []);
  const [report, setReport] = useHistoryPanel(reportParameter, [
    "pronunciation",
    ...reviewItems.map((item) => `correction:${item.candidate.candidateId}`),
    ...segments.map((segment) => `sentence:${segment.id}`),
  ]);
  const selected = segments.find(
    (segment) => report === `sentence:${segment.id}`,
  );
  const openSentence = (segment: AnalysisSegment) =>
    setReport(`sentence:${segment.id}`);
  const unavailable = segments.filter(
    (segment) => segment.pronunciationScore == null,
  );
  const needsReview = segments.filter(
    (segment) =>
      segment.pronunciationScore != null && segment.resultStatus !== "NORMAL",
  );
  const good = segments.filter(
    (segment) =>
      segment.pronunciationScore != null && segment.resultStatus === "NORMAL",
  );
  const overallScore = analysis.overallScore ?? analysis.pronunciationScore;
  const canonicalCoaching = analysis.canonical?.canonicalAnalysis?.coaching;
  const summary =
    (canonicalCoaching?.adapterStatus === "READY" &&
      canonicalCoaching.feedback?.trim()) ||
    analysis.summaryFeedback?.trim() ||
    "제공된 AI 총평이 없습니다.";
  const scoreRows = useMemo(() => {
    const score = analysis.canonical?.canonicalAnalysis?.score;
    if (score?.validity === "RUBRIC_COMPUTED") {
      return canonicalCriterionPoints(score).map((row) => ({
        id: row.criterionId,
        label: row.label,
        description:
          "이번 녹음에서 분석한 발음 항목의 점수예요. 원고에 없는 항목은 종합 점수에서 제외해요.",
        score: row.points,
        maxScore: row.maxPoints,
        available: row.points != null,
        phones: [] as string[],
        sampleCount: null as number | null,
      }));
    }
    if (analysis.scoreBreakdown?.items.length) {
      return analysis.scoreBreakdown.items.map((item) => ({
        id: item.criterionId,
        label: item.label,
        description: item.description,
        score: item.score,
        maxScore: item.maxScore,
        available: item.applicable,
        phones: item.expectedPhones,
        sampleCount: item.sampleCount,
      }));
    }
    if (analysis.scoreHierarchy?.groups.length) {
      return visibleAnalysisScoreGroups(
        analysis.scoreHierarchy.groups,
        isCameraPractice,
      ).map((group) => ({
        id: group.id,
        label: group.label,
        description: group.description,
        score: group.score,
        maxScore: group.maxScore,
        available: group.score != null,
        phones: [] as string[],
        sampleCount: null as number | null,
      }));
    }
    return [];
  }, [
    analysis.canonical,
    analysis.scoreBreakdown,
    analysis.scoreHierarchy,
    isCameraPractice,
  ]);

  let overlay: ReactNode = null;
  if (report === "pronunciation") {
    overlay = (
      <ReportOverlay title="발음 분석" onBack={() => setReport(null)}>
        <div className="px-5 pt-1">
          <section className="flex flex-col items-center gap-1.5 rounded-[18px] bg-white px-5 pt-7 pb-6">
            <ReportScore score={overallScore} large />
            <h2 className="text-[15px] leading-[22px] font-bold">종합 점수</h2>
            <p className="text-xs leading-4 text-[#8b95a1]">
              이번 녹음의 발음 분석 결과예요
            </p>
          </section>
        </div>
        <div className="space-y-2.5 px-5 pt-3 pb-6">
          {scoreRows.length ? (
            scoreRows.map((row) => (
              <ScoreAccordion
                key={row.id}
                header={
                  <>
                    <strong className="min-w-0 flex-1 text-[16px] leading-6">
                      {row.label}
                      {row.label === "대본과 음성의 대응" && (
                        <span className="mt-0.5 block text-xs leading-4 font-normal text-[#8b95a1]">
                          기대한 소리와 녹음 소리의 대응 정도
                        </span>
                      )}
                    </strong>
                    <span className="shrink-0 text-[16px] leading-6">
                      {row.available && row.score != null ? (
                        <>
                          <b>{formatPoints(row.score)}</b>
                          <span className="font-medium text-[#8b95a1]">
                            {row.maxScore == null
                              ? "점"
                              : ` / ${formatPoints(row.maxScore)}점`}
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] text-[#8b95a1]">
                          {row.available ? "점수 미제공" : "평가 대상 없음"}
                        </span>
                      )}
                    </span>
                    <Image
                      src="/figma/report/chevron.svg"
                      alt=""
                      width={18}
                      height={18}
                    />
                  </>
                }
              >
                <div className={styles.criterionBody}>
                  {row.phones.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-[#8b95a1]">
                        이번 문장에서 분석한 소리
                      </p>
                      <div className={styles.phones}>
                        {row.phones.map((phone, index) => (
                          <span
                            key={`${phone}-${index}`}
                            style={{ transitionDelay: `${80 + index * 60}ms` }}
                          >
                            {phone}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  <p>{row.description || "세부 설명이 제공되지 않았습니다."}</p>
                  {row.sampleCount != null && (
                    <p className="mt-3 text-xs text-[#8b95a1]">
                      분석 대상{" "}
                      <b className="text-[#4e5968]">{row.sampleCount}개</b>
                    </p>
                  )}
                </div>
              </ScoreAccordion>
            ))
          ) : (
            <section className="rounded-2xl bg-white px-5 py-8 text-center">
              <h2 className="text-[15px] font-bold">세부 점수 데이터 미제공</h2>
              <p className="mt-2 text-[13px] leading-5 text-[#8b95a1]">
                이번 분석에는 항목별 발음 점수가 포함되지 않았어요.
              </p>
            </section>
          )}
        </div>
      </ReportOverlay>
    );
  }

  if (selected) {
    const index = segments.findIndex(
      (segment) => String(segment.id) === String(selected.id),
    );
    const problem = selected.resultStatus !== "NORMAL";
    overlay = (
      <ReportOverlay
        title="문장별 피드백"
        trailing={`${Math.max(1, index + 1)} / ${Math.max(segments.length, 1)}`}
        onBack={() => setReport(null)}
        footer={
          <button
            type="button"
            onClick={() => setReport(null)}
            className="h-14 w-full rounded-full bg-primary text-[16px] leading-6 font-bold text-white"
          >
            확인하기
          </button>
        }
      >
        <div className="px-5 pt-1">
          <section className="rounded-2xl bg-white px-5 py-[18px]">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md px-[7px] py-[3px] text-[11px] leading-[14px] font-bold text-[#4e5968]">
                {String(selected.sequenceNo).padStart(2, "0")}
              </span>
              <span
                className={`flex items-center gap-1 rounded-md px-[7px] py-[3px] text-[11px] leading-[14px] font-bold ${problem ? "bg-[#fff2f3] text-[#f04f5f]" : "bg-[#eefaf6] text-[#10a87b]"}`}
              >
                <ReportIcon name={problem ? "warning" : "check"} size={12} />
                {problem ? "다시 확인" : "잘 읽음"}
              </span>
            </div>
            <p className="mt-2 text-[17px] leading-6 font-bold">
              <HighlightedText
                text={segmentText(selected)}
                targets={
                  problem && selected.targetUnit ? [selected.targetUnit] : []
                }
              />
            </p>
          </section>
        </div>

        <div className="space-y-3 px-5 pt-4 pb-6">
          {problem ? (
            <section className="pb-1">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] leading-[22px] font-bold">
                  다시 확인할 단어
                </h2>
                <strong className="text-[14px] text-primary">
                  {selected.targetUnit ? "1개" : "데이터 미제공"}
                </strong>
              </div>
              {selected.targetUnit ? (
                <span className="mt-2.5 inline-flex rounded-full bg-primary px-4 py-2 text-[15px] leading-[22px] font-bold text-white">
                  {selected.targetUnit}
                </span>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl bg-white p-5">
            <h2 className="text-[20px] leading-7 font-bold">
              {selected.targetUnit || segmentText(selected)}
            </h2>
            <div className="mt-2.5">
              <CorrectionCard
                segment={selected}
                details={pronunciationDetails[String(selected.id)]}
                recordingUrl={recordingUrl}
                recordingId={recordingId}
                content={content}
              />
            </div>
            {pronunciationDetails[String(selected.id)]
              ?.filter((item) => item.tip)
              .map((item, index) => (
                <div key={index} className={styles.tip}>
                  <strong>TIP</strong>
                  <p>{item.tip}</p>
                </div>
              ))}
            <h3 className="mt-[18px] text-[15px] leading-[22px] font-bold">
              소리 비교
            </h3>
            <div className="mt-2.5 space-y-2.5">
              {recordingUrl || recordingId != null ? (
                <ReferencePlayer
                  source={recordingUrl}
                  recordingId={recordingId}
                  title="내 음성 듣기"
                  {...recordingRange(selected)}
                  buttonTone="primary"
                />
              ) : (
                <UnavailableAudio label="내 음성 데이터 없음" primary />
              )}
              <GuidePlayer
                contentId={content.id}
                available={content.referenceAudioAvailable}
                text={selected.expectedText || content.scriptText}
                title="가이드 음성 듣기"
                buttonTone="neutral"
              />
            </div>
          </section>

          <div className="flex items-center justify-between px-1 pt-2">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => openSentence(segments[index - 1])}
              className="flex min-h-11 items-center gap-0.5 text-[13px] font-bold text-[#4e5968] disabled:opacity-35"
            >
              <Image
                src="/figma/settings/back.svg"
                alt=""
                width={16}
                height={16}
              />
              이전 문장
            </button>
            <button
              type="button"
              disabled={index < 0 || index >= segments.length - 1}
              onClick={() => openSentence(segments[index + 1])}
              className="flex min-h-11 items-center gap-0.5 text-[13px] font-bold text-[#4e5968] disabled:opacity-35"
            >
              다음 문장
              <Image
                src="/figma/report/chevron.svg"
                alt=""
                width={16}
                height={16}
              />
            </button>
          </div>
        </div>
      </ReportOverlay>
    );
  }

  const selectedCorrection = reviewItems.find(
    (item) => report === `correction:${item.candidate.candidateId}`,
  );
  if (selectedCorrection) {
    const word = selectedCorrection.candidate.facts[0]?.location.word;
    const index = reviewItems.indexOf(selectedCorrection);
    overlay = (
      <ReportOverlay
        title="발음별 피드백"
        trailing={`${index + 1} / ${reviewItems.length}`}
        onBack={() => setReport(null)}
        footer={
          <button
            type="button"
            onClick={() => setReport(null)}
            className="h-14 w-full rounded-full bg-primary text-base font-bold text-white"
          >
            확인하기
          </button>
        }
      >
        <div className="space-y-4 px-5 pt-1 pb-6">
          <section className="rounded-2xl bg-white px-5 py-[18px]">
            <p className="mb-2 text-xs font-bold text-[#f04f5f]">
              다시 확인할 발음
            </p>
            <p className="text-[17px] leading-6 font-bold">
              <HighlightedText
                text={content.scriptText}
                targets={word ? [word] : []}
              />
            </p>
          </section>
          <section className="rounded-2xl bg-white p-5">
            <h2 className="mb-2.5 text-xl font-bold">
              {word || selectedCorrection.candidate.expectedPhone}
            </h2>
            <CorrectionComparison
              item={selectedCorrection}
              recordingUrl={recordingUrl}
              recordingId={recordingId}
              detail
            />
            <h3 className="mt-[18px] text-[15px] font-bold">소리 비교</h3>
            <div className="mt-2.5 space-y-2.5">
              {recordingUrl || recordingId != null ? (
                <ReferencePlayer
                  source={recordingUrl}
                  recordingId={recordingId}
                  title="내 녹음 전체 듣기"
                  buttonTone="primary"
                />
              ) : (
                <UnavailableAudio label="내 음성 데이터 없음" primary />
              )}
              <GuidePlayer
                contentId={content.id}
                available={content.referenceAudioAvailable}
                text={content.scriptText}
                title="가이드 전체 듣기"
                buttonTone="neutral"
              />
            </div>
          </section>
        </div>
      </ReportOverlay>
    );
  }

  return (
    <>
      <div
        inert={overlay != null}
        aria-hidden={overlay != null}
        className={`${styles.report} ${styles.reportEntrance} min-w-0 max-w-full space-y-5 px-5 py-4 overflow-x-clip [touch-action:pan-y_pinch-zoom] [overflow-wrap:anywhere] ${overlay ? "invisible" : ""}`}
      >
        <section className="flex flex-col items-center gap-4 pt-2">
          <AnalysisSummary key={summary} text={summary} />
        </section>

        <section className="rounded-2xl bg-white p-4">
          <h2 className="text-[12px] leading-4 font-bold text-[#8b95a1]">
            연습 문장
          </h2>
          <p className="mt-1.5 text-[15px] leading-[1.5] font-medium">
            <HighlightedText
              text={content.scriptText}
              targets={[
                ...needsReview.flatMap((item) =>
                  item.targetUnit ? [item.targetUnit] : [],
                ),
                ...reviewItems.flatMap((item) =>
                  item.candidate.facts.map((fact) => fact.location.word),
                ),
              ]}
              primary
            />
          </p>
          <div className="mt-3.5 grid grid-cols-2 gap-2">
            {/* Stop playback and cancel pending audio loads when details open. */}
            {recordingUrl || recordingId != null ? (
              <ReferencePlayer
                key={overlay ? "hidden-recording" : "summary-recording"}
                dense
                source={recordingUrl}
                recordingId={recordingId}
                title="내 녹음 전체 듣기"
                buttonTone="primary"
              />
            ) : (
              <UnavailableAudio label="내 녹음 데이터 없음" primary />
            )}
            <GuidePlayer
              key={overlay ? "hidden-guide" : "summary-guide"}
              dense
              contentId={content.id}
              available={content.referenceAudioAvailable}
              text={content.scriptText}
              title="가이드 전체 듣기"
              buttonTone="neutral"
            />
          </div>
        </section>

        {analysis.canonical && (
          <CanonicalLipResult
            view={analysis.canonical}
            isCameraPractice={isCameraPractice}
          />
        )}

        <button
          type="button"
          onClick={() => setReport("pronunciation")}
          className={styles.scoreCard}
        >
          <ReportScore score={overallScore} />
          <span className="flex items-center gap-0.5 text-[17px] leading-6 font-bold">
            종합 점수
            <Image
              src="/figma/report/chevron.svg"
              alt=""
              width={18}
              height={18}
            />
          </span>
        </button>

        {reviewItems.length > 0 && (
          <section className="rounded-[20px] bg-white px-5 py-0.5">
            <h2 className="flex min-h-[54px] items-center gap-2 text-[17px] font-bold">
              <ReportIcon name="warning" />
              <span className="flex-1">다시 확인할 발음</span>
              <span className="text-[13px] text-[#f04f5f]">
                {reviewItems.length}개
              </span>
            </h2>
            {reviewItems.map((item, index) => (
              <div key={item.candidate.candidateId} className="pb-4">
                <button
                  type="button"
                  onClick={() =>
                    setReport(`correction:${item.candidate.candidateId}`)
                  }
                  className="flex min-h-11 w-full items-start gap-3 pb-2.5 text-left"
                >
                  <span className="text-[13px] leading-6 text-[#8b95a1]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-base font-medium">
                    {item.candidate.facts[0]?.location.word ||
                      item.candidate.expectedPhone}
                  </span>
                  <Image
                    src="/figma/report/chevron.svg"
                    alt=""
                    width={16}
                    height={16}
                    className="mt-1"
                  />
                </button>
                <CorrectionComparison
                  key={overlay ? "hidden" : "visible"}
                  item={item}
                  recordingUrl={recordingUrl}
                  recordingId={recordingId}
                  disabled={overlay != null}
                />
              </div>
            ))}
          </section>
        )}
        {segments.length ? (
          <div className="space-y-3">
            <SegmentSection
              title="다시 확인해 보세요"
              pronunciationDetails={pronunciationDetails}
              renderCorrection={(segment) => (
                <CorrectionCard
                  key={overlay ? "hidden" : "visible"}
                  segment={segment}
                  details={pronunciationDetails[String(segment.id)]}
                  recordingUrl={overlay ? undefined : recordingUrl}
                  recordingId={overlay ? undefined : recordingId}
                  content={content}
                  disabled={overlay != null}
                />
              )}
              items={needsReview}
              icon="warning"
              tone="warning"
              onSelect={openSentence}
            />
            <SegmentSection
              title="잘 읽은 문장"
              items={good}
              icon="check"
              tone="check"
              onSelect={openSentence}
            />
            <SegmentSection
              title="분석이 어려운 문장"
              items={unavailable}
              icon="info"
              tone="info"
              defaultOpen={false}
              onSelect={openSentence}
            />
          </div>
        ) : reviewItems.length ? null : (
          <section className="rounded-[20px] bg-white p-5">
            <h2 className="text-[17px] leading-6 font-bold">이번 연습 결과</h2>
            <PracticeResultSummary
              analysis={analysis}
              practiceResult={practiceResult}
              decisionStatus={practiceDecisionStatus}
              sentenceMode={sentenceMode}
            />
          </section>
        )}

        {analysis.pronunciationEvidence ? (
          <section className="rounded-[20px] bg-white p-5">
            <h2 className="text-[15px] leading-[22px] font-bold">교정 근거</h2>
            <p className="mt-2 text-[13px] leading-5 text-[#6b7684]">
              선택된 발음 단위: {analysis.pronunciationEvidence.selectedPhone}
            </p>
          </section>
        ) : null}
      </div>
      {overlay}
    </>
  );
}

/** Present only supplied utterance results; no score-to-grade thresholds. */
function PracticeResultSummary({
  analysis,
  practiceResult,
  decisionStatus,
  sentenceMode,
}: {
  analysis: AnalysisResult;
  practiceResult?: DirectResult["practiceResult"];
  decisionStatus?: string;
  sentenceMode?: boolean;
}) {
  const decision =
    practiceResult?.decisionStatus ??
    decisionStatus ??
    analysis.canonical?.canonicalAnalysis?.decision.status;
  const failed = analysis.status === "FAILED" || decision === "SYSTEM_FAILURE";
  const accepted = !failed && (decision == null || decision === "ACCEPT");
  const score = accepted
    ? (practiceResult?.score.overallScore ?? analysis.overallScore)
    : null;
  const feedback = accepted
    ? practiceResult?.feedback?.trim() || analysis.summaryFeedback?.trim()
    : analysis.summaryFeedback?.trim();
  return (
    <div className="mt-3 space-y-2 text-[13px] leading-5">
      <p className="font-medium text-[#4e5968]">
        {failed
          ? "분석 결과를 확정하지 못했어요."
          : !accepted
            ? "이번 입력은 평가를 완료하지 못했어요."
            : score != null
              ? `${sentenceMode ? "이 문장 분석" : "전체 녹음 종합"} 점수 ${formatPoints(score)}점`
              : "이번 녹음에는 종합 점수가 제공되지 않았어요."}
      </p>
      {feedback && (
        <p className="whitespace-pre-line text-[#6b7684]">{feedback}</p>
      )}
      {accepted && (
        <p className="text-[#8b95a1]">
          {sentenceMode
            ? "이 문장만 녹음한 음성을 기준으로 분석한 결과예요."
            : "전체 녹음을 기준으로 한 결과예요. 문장별 점수와 판정은 따로 제공하지 않아요."}
        </p>
      )}
    </div>
  );
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function SegmentSection({
  title,
  items,
  icon,
  tone,
  onSelect,
  defaultOpen = true,
  renderCorrection,
  pronunciationDetails = {},
}: {
  title: string;
  items: AnalysisSegment[];
  icon: "warning" | "check" | "info";
  tone: "warning" | "check" | "info";
  onSelect: (segment: AnalysisSegment) => void;
  defaultOpen?: boolean;
  renderCorrection?: (segment: AnalysisSegment) => ReactNode;
  pronunciationDetails?: Record<string, PronunciationDetail[]>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const toneText = {
    warning: "text-[#f04f5f]",
    check: "text-[#10a87b]",
    info: "text-[#8b95a1]",
  }[tone];
  return (
    <section className="rounded-[20px] bg-white px-5 py-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[54px] w-full cursor-pointer items-center gap-2 text-left"
      >
        <ReportIcon name={icon} />
        <strong className="min-w-0 flex-1 text-[17px] leading-6">
          {title}
        </strong>
        <span className={`text-[13px] leading-[18px] font-bold ${toneText}`}>
          {items.length}개
        </span>
        <Image
          src="/figma/report/chevron.svg"
          alt=""
          width={18}
          height={18}
          className={styles.sectionChevron}
          data-open={open}
        />
      </button>
      <div
        id={contentId}
        className={styles.sectionCollapse}
        data-open={open}
        inert={!open}
      >
        <div className={styles.sectionContent}>
          {items.map((segment) => (
            <div key={String(segment.id)}>
              <button
                type="button"
                onClick={() => onSelect(segment)}
                className="flex min-h-[56px] w-full items-start gap-3 pb-4 pt-1 text-left"
              >
                <span className="shrink-0 pt-0.5 text-[13px] leading-6 text-[#8b95a1]">
                  {String(segment.sequenceNo).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[16px] leading-6 font-medium">
                  <HighlightedText
                    text={segmentText(segment)}
                    targets={
                      tone === "warning"
                        ? [
                            ...(segment.targetUnit ? [segment.targetUnit] : []),
                            ...(
                              pronunciationDetails[String(segment.id)] || []
                            ).map((item) => item.word),
                          ]
                        : []
                    }
                  />
                </span>
                <Image
                  src="/figma/report/chevron.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="mt-1"
                />
              </button>
              {renderCorrection && (
                <div className="pb-4">{renderCorrection(segment)}</div>
              )}
            </div>
          ))}
          {items.length === 0 ? (
            <p className="pb-4 text-[13px] text-[#8b95a1]">
              해당하는 문장이 없어요.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function UnavailableAudio({
  label,
  primary = false,
}: {
  label: string;
  primary?: boolean;
}) {
  return (
    <span
      aria-disabled="true"
      className={`flex h-12 items-center justify-center rounded-2xl px-2 text-center text-[12px] font-bold ${primary ? "bg-[#f0edff] text-[#b5a8eb]" : "bg-[#f2f4f6] text-[#8b95a1]"}`}
    >
      {label}
    </span>
  );
}

function ReportOverlay({
  title,
  trailing,
  onBack,
  footer,
  children,
}: {
  title: string;
  trailing?: string;
  onBack: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className={`${styles.report} fixed inset-0 z-[70] mx-auto flex h-dvh w-full max-w-[402px] flex-col overflow-x-clip bg-[#f2f4f6] pt-[env(safe-area-inset-top,0px)] text-[#191f28] outline-none [touch-action:pan-y_pinch-zoom]`}
        >
          <header className="relative flex h-12 shrink-0 items-center px-2 py-1">
            <button
              type="button"
              onClick={onBack}
              aria-label="피드백으로 돌아가기"
              className="flex size-10 items-center justify-center"
            >
              <Image
                src="/figma/settings/back.svg"
                alt=""
                width={24}
                height={24}
              />
            </button>
            <Dialog.Title asChild>
              <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
                {title}
              </h1>
            </Dialog.Title>
            {trailing ? (
              <span className="absolute right-3 text-[12px] leading-4 font-bold text-[#8b95a1]">
                {trailing}
              </span>
            ) : null}
          </header>
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain [overflow-wrap:anywhere]">
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 bg-white px-5 pt-3 pb-[max(24px,env(safe-area-inset-bottom,0px))]">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function recordingRange(segment: {
  startMs: number | null;
  endMs: number | null;
}) {
  if (
    segment.startMs == null ||
    segment.endMs == null ||
    segment.startMs < 0 ||
    segment.endMs <= segment.startMs
  )
    return {};
  return {
    startSeconds: segment.startMs / 1000,
    endSeconds: segment.endMs / 1000,
  };
}

function HighlightedText({
  text,
  targets,
  primary = false,
}: {
  text: string;
  targets: string[];
  primary?: boolean;
}) {
  const words = [...new Set(targets.filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  );
  if (!words.length) return <>{text}</>;
  const pattern = new RegExp(
    `(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );
  return (
    <>
      {text.split(pattern).map((part, index) =>
        words.includes(part) ? (
          <span
            key={index}
            className={`underline underline-offset-4 ${primary ? "text-primary" : "text-[#f04f5f]"}`}
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function CorrectionCard({
  segment,
  details,
  recordingUrl,
  recordingId,
  content,
  disabled = false,
}: {
  segment: AnalysisSegment;
  details?: PronunciationDetail[];
  recordingUrl?: string;
  recordingId?: Id;
  content: AnalysisViewContent;
  disabled?: boolean;
}) {
  const entries = details?.length
    ? details
    : [
        {
          word: segment.targetUnit || "",
          observed: segment.recognizedText || "",
          expected: segment.expectedText || "",
          feedback: segment.feedback || "",
        },
      ];
  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div className={styles.correction} key={index}>
          {entries.length > 1 && (
            <strong className="text-base">{entry.word}</strong>
          )}
          <div className={styles.comparisonLine}>
            <span className={styles.chip}>내 발음</span>
            <strong>
              <PhoneDifference text={entry.observed} other={entry.expected} />
            </strong>
            <ReferencePlayer
              source={recordingUrl}
              recordingId={recordingId}
              {...recordingRange(segment)}
              title="내 음성 듣기"
              variant="comparison"
              disabled={disabled || (!recordingUrl && recordingId == null)}
            />
          </div>
          <div className={styles.comparisonLine}>
            <span className={styles.chip} data-tone="correct">
              바른 발음
            </span>
            <strong>
              <PhoneDifference
                text={entry.expected}
                other={entry.observed}
                correct
              />
            </strong>
            <GuidePlayer
              contentId={content.id}
              available={content.referenceAudioAvailable}
              text={entry.expected || content.scriptText}
              title="가이드 전체 듣기"
              variant="comparison"
              buttonTone="primary"
              disabled={disabled}
            />
          </div>
          <div className={styles.feedbackLine}>
            <span className={styles.chip} data-tone="feedback">
              피드백
            </span>
            <p>
              {entry.feedback.trim() ||
                "이 문장의 세부 피드백이 제공되지 않았어요."}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScoreAccordion({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section className={styles.criterion} data-open={open}>
      <button
        type="button"
        className={styles.criterionToggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {header}
      </button>
      <div
        id={id}
        className={styles.sectionCollapse}
        data-open={open}
        inert={!open}
      >
        <div className={styles.sectionContent}>{children}</div>
      </div>
    </section>
  );
}
