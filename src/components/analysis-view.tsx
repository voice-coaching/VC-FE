"use client";

import Image from "next/image";
import { useMemo, type ReactNode } from "react";
import { useHistoryPanel } from "@/hooks/use-history-panel";
import { ReferencePlayer } from "@/components/reference-player";
import { AnalysisSummary } from "@/components/analysis-summary";
import { CanonicalLipResult } from "@/components/canonical-lip-result";
import { canonicalCriterionPoints } from "@/lib/canonical-score";
import {
  CorrectionComparison,
  type ReportCorrection,
} from "@/components/report-correction";
import { ReportScore } from "@/components/report-score";
import styles from "./report-design.module.css";
import type {
  AnalysisResult,
  AnalysisSegment,
  Id,
  PracticeContent,
} from "@/lib/api";

const CONTENT_LABEL: Record<PracticeContent["contentType"], string> = {
  NEWS: "뉴스 읽기",
  SENTENCE: "문장 연습",
  ANNOUNCER: "아나운서 따라 읽기",
  CLASS_PRACTICE: "클래스",
};

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

export function AnalysisView({
  analysis,
  segments,
  content,
  recordingUrl,
  recordingId,
  courseMode = false,
  reportParameter = "report",
  corrections,
}: {
  analysis: AnalysisResult;
  segments: AnalysisSegment[];
  content: AnalysisViewContent;
  recordingUrl?: string;
  recordingId?: Id;
  courseMode?: boolean;
  reportParameter?: string;
  corrections?: ReportCorrection[];
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
  const sourceLabel = courseMode
    ? "클래스"
    : CONTENT_LABEL[content.contentType];
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
      return analysis.scoreHierarchy.groups.map((group) => ({
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
  }, [analysis.canonical, analysis.scoreBreakdown, analysis.scoreHierarchy]);

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
              <details key={row.id} className={styles.criterion}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 px-[18px] py-4 marker:hidden">
                  <strong className="min-w-0 flex-1 text-[16px] leading-6">
                    {row.label}
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
                </summary>
                <div className={styles.criterionBody}>
                  {row.phones.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-[#8b95a1]">
                        이번 문장에서 분석한 소리
                      </p>
                      <div className={styles.phones}>
                        {row.phones.map((phone, index) => (
                          <span key={`${phone}-${index}`}>{phone}</span>
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
              </details>
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
                recordingUrl={recordingUrl}
                recordingId={recordingId}
                content={content}
              />
            </div>
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
              {content.referenceAudioAvailable ? (
                <ReferencePlayer
                  contentId={content.id}
                  title="가이드 음성 듣기"
                  buttonTone="neutral"
                />
              ) : (
                <UnavailableAudio label="가이드 음성 데이터 없음" />
              )}
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
              {content.referenceAudioAvailable ? (
                <ReferencePlayer
                  contentId={content.id}
                  title="가이드 전체 듣기"
                  buttonTone="neutral"
                />
              ) : (
                <UnavailableAudio label="가이드 음성 데이터 없음" />
              )}
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
        className={`min-w-0 max-w-full space-y-5 px-5 py-4 overflow-x-clip [touch-action:pan-y_pinch-zoom] [overflow-wrap:anywhere] ${overlay ? "invisible" : ""}`}
      >
        <section className="flex flex-col items-center gap-4 pt-2">
          <p className="flex min-w-0 max-w-full items-center gap-2 text-[13px] leading-[18px]">
            <b className="shrink-0 text-primary">{sourceLabel}</b>
            <span className="h-2.5 w-px shrink-0 bg-[#e5e8eb]" />
            <span className="min-w-0 max-w-[240px] truncate font-medium text-[#8b95a1]">
              {content.title}
            </span>
          </p>
          <AnalysisSummary key={summary} text={summary} />
        </section>
        {analysis.canonical && <CanonicalLipResult view={analysis.canonical} />}

        <section className="rounded-2xl bg-gradient-to-b from-white to-[#f6f8ff] p-4">
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
            {content.referenceAudioAvailable ? (
              <ReferencePlayer
                key={overlay ? "hidden-guide" : "summary-guide"}
                dense
                contentId={content.id}
                title="가이드 전체 듣기"
                buttonTone="neutral"
              />
            ) : (
              <UnavailableAudio label="가이드 데이터 없음" />
            )}
          </div>
        </section>

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
              renderCorrection={(segment) => (
                <CorrectionCard
                  key={overlay ? "hidden" : "visible"}
                  segment={segment}
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
            <p className="mt-2 text-[13px] leading-5 text-[#8b95a1]">
              문장별 분석 데이터가 제공되지 않았어요.
            </p>
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
}: {
  title: string;
  items: AnalysisSegment[];
  icon: "warning" | "check" | "info";
  tone: "warning" | "check" | "info";
  onSelect: (segment: AnalysisSegment) => void;
  defaultOpen?: boolean;
  renderCorrection?: (segment: AnalysisSegment) => ReactNode;
}) {
  const toneText = {
    warning: "text-[#f04f5f]",
    check: "text-[#10a87b]",
    info: "text-[#8b95a1]",
  }[tone];
  return (
    <details open={defaultOpen} className="rounded-[20px] bg-white px-5 py-0.5">
      <summary className="flex min-h-[54px] cursor-pointer list-none items-center gap-2 marker:hidden">
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
          className="rotate-90"
        />
      </summary>
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
                  tone === "warning" && segment.targetUnit
                    ? [segment.targetUnit]
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
    </details>
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
      className={`flex h-12 items-center justify-center rounded-2xl px-2 text-center text-[12px] font-bold ${primary ? "bg-[#edf2ff] text-[#8fa9e8]" : "bg-[#f2f4f6] text-[#8b95a1]"}`}
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
    <div className="fixed inset-0 z-[70] mx-auto flex h-dvh w-full max-w-[402px] flex-col overflow-x-clip bg-[#f2f4f6] pt-[env(safe-area-inset-top,0px)] text-[#191f28] [touch-action:pan-y_pinch-zoom]">
      <header className="relative flex h-12 shrink-0 items-center px-2 py-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="피드백으로 돌아가기"
          className="flex size-10 items-center justify-center"
        >
          <Image src="/figma/settings/back.svg" alt="" width={24} height={24} />
        </button>
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold">
          {title}
        </h1>
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
    </div>
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
  recordingUrl,
  recordingId,
  content,
  disabled = false,
}: {
  segment: AnalysisSegment;
  recordingUrl?: string;
  recordingId?: Id;
  content: AnalysisViewContent;
  disabled?: boolean;
}) {
  return (
    <div className={styles.correction}>
      <div className={styles.comparisonLine}>
        <span className={styles.chip}>인식된 말</span>
        <strong>{segment.recognizedText || "데이터 미제공"}</strong>
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
          원문
        </span>
        <strong>{segment.expectedText || "데이터 미제공"}</strong>
        <ReferencePlayer
          contentId={content.id}
          title="가이드 전체 듣기"
          variant="comparison"
          buttonTone="primary"
          disabled={disabled || !content.referenceAudioAvailable}
        />
      </div>
      <div className={styles.feedbackLine}>
        <span className={styles.chip} data-tone="feedback">
          피드백
        </span>
        <p>
          {segment.feedback?.trim() ||
            "이 문장의 세부 피드백이 제공되지 않았어요."}
        </p>
      </div>
    </div>
  );
}
