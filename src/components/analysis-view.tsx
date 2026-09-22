"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { ReferencePlayer } from "@/components/reference-player";
import type {
  AnalysisResult,
  AnalysisSegment,
  Id,
  PracticeContent,
} from "@/lib/api";

type ReportView = "summary" | "pronunciation" | "sentence";

const CONTENT_LABEL: Record<PracticeContent["contentType"], string> = {
  NEWS: "뉴스 읽기",
  SENTENCE: "문장 연습",
  ANNOUNCER: "아나운서 따라 읽기",
  CLASS_PRACTICE: "클래스",
};

function scoreText(score: number | null) {
  return score == null ? "—" : String(Math.round(score));
}

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

export function AnalysisView({
  analysis,
  segments,
  content,
  recordingUrl,
  recordingId,
  courseMode = false,
}: {
  analysis: AnalysisResult;
  segments: AnalysisSegment[];
  content: PracticeContent;
  recordingUrl?: string;
  recordingId?: Id;
  courseMode?: boolean;
}) {
  const [view, setView] = useState<ReportView>("summary");
  const [selected, setSelected] = useState<AnalysisSegment | null>(null);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
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
  const summary =
    analysis.summaryFeedback?.trim() || "제공된 AI 총평이 없습니다.";
  const sourceLabel = courseMode
    ? "클래스"
    : CONTENT_LABEL[content.contentType];

  const scoreRows = useMemo(() => {
    if (analysis.scoreBreakdown?.items.length) {
      return analysis.scoreBreakdown.items.map((item) => ({
        id: item.criterionId,
        label: item.label,
        description: item.description,
        score: item.score,
        maxScore: item.maxScore,
        available: item.applicable,
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
      }));
    }
    return [];
  }, [analysis.scoreBreakdown, analysis.scoreHierarchy]);

  if (view === "pronunciation") {
    return (
      <ReportOverlay title="발음 분석" onBack={() => setView("summary")}>
        <div className="px-5 pt-1">
          <section className="flex min-h-[112px] items-center gap-3 rounded-[18px] bg-white px-5 py-[18px]">
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] leading-[22px] font-bold">
                종합 점수
              </h2>
              <p className="mt-1 text-[12px] leading-4 text-[#8b95a1]">
                이번 녹음의 발음 분석 결과예요
              </p>
            </div>
            <ScoreRing score={overallScore} />
          </section>
        </div>
        <div className="space-y-2.5 px-5 pt-3 pb-6">
          {scoreRows.length ? (
            scoreRows.map((row) => (
              <details
                key={row.id}
                className="overflow-hidden rounded-2xl bg-white"
              >
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
                    className="rotate-90"
                  />
                </summary>
                <p className="border-t border-[#f2f4f6] px-[18px] py-4 text-[13px] leading-5 text-[#6b7684]">
                  {row.description || "세부 설명이 제공되지 않았습니다."}
                </p>
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

  if (view === "sentence" && selected) {
    const index = segments.findIndex(
      (segment) => String(segment.id) === String(selected.id),
    );
    const problem = selected.resultStatus !== "NORMAL";
    return (
      <ReportOverlay
        title="문장별 피드백"
        trailing={`${Math.max(1, index + 1)} / ${Math.max(segments.length, 1)}`}
        onBack={() => {
          setSelected(null);
          setView("summary");
        }}
        footer={
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setView("summary");
            }}
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
              {segmentText(selected)}
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
            <p className="mt-2.5 text-[15px] leading-6 font-medium">
              {selected.feedback?.trim() ||
                (problem
                  ? "이 문장에 대한 세부 피드백이 제공되지 않았어요."
                  : "이번 문장은 또렷하게 읽었어요.")}
            </p>
            {problem && selected.recognizedText ? (
              <p className="mt-3 rounded-xl bg-[#fff2f3] px-3 py-2 text-[13px] text-[#f04f5f]">
                인식된 소리: {selected.recognizedText}
              </p>
            ) : null}
            <h3 className="mt-[18px] text-[15px] leading-[22px] font-bold">
              소리 비교
            </h3>
            <div className="mt-2.5 space-y-2.5">
              {recordingUrl || recordingId != null ? (
                <ReferencePlayer
                  source={recordingUrl}
                  recordingId={recordingId}
                  title="내 음성 듣기"
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
              onClick={() => setSelected(segments[index - 1])}
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
              onClick={() => setSelected(segments[index + 1])}
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

  return (
    <div className="space-y-5">
      <section className="flex flex-col items-center gap-4 pt-2">
        <p className="flex items-center gap-2 text-[13px] leading-[18px]">
          <b className="text-primary">{sourceLabel}</b>
          <span className="h-2.5 w-px bg-[#e5e8eb]" />
          <span className="max-w-[240px] truncate font-medium text-[#8b95a1]">
            {content.title}
          </span>
        </p>
        <div className="w-full rounded-[18px] bg-primary px-4 py-3.5 text-white">
          <div className="flex items-center gap-1">
            <Image
              src="/figma/report/ai-sparkle.svg"
              alt=""
              width={14}
              height={14}
            />
            <h2 className="text-[12px] leading-4 font-bold">AI 총평</h2>
          </div>
          <p
            className={`mt-1.5 text-[14px] leading-5 font-medium ${summaryExpanded ? "" : "line-clamp-3"}`}
          >
            {summary}
          </p>
          {summary.length > 80 ? (
            <button
              type="button"
              aria-expanded={summaryExpanded}
              onClick={() => setSummaryExpanded((value) => !value)}
              className="mt-1.5 flex min-h-8 w-full items-center justify-center gap-0.5 text-[13px] font-bold"
            >
              {summaryExpanded ? "접기" : "더보기"}
              <Image
                src="/figma/report/chevron-white.svg"
                alt=""
                width={14}
                height={14}
                className={summaryExpanded ? "-rotate-90" : "rotate-90"}
              />
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4">
        <h2 className="text-[12px] leading-4 font-bold text-[#8b95a1]">
          연습 문장
        </h2>
        <p className="mt-1.5 text-[15px] leading-[1.5] font-medium">
          {content.scriptText}
        </p>
        <div className="mt-3.5 grid grid-cols-2 gap-2">
          {recordingUrl || recordingId != null ? (
            <ReferencePlayer
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
        onClick={() => setView("pronunciation")}
        className="flex min-h-[72px] w-full items-center gap-3 rounded-[20px] bg-white p-5 text-left"
      >
        <strong className="flex-1 text-[17px] leading-6">종합 점수</strong>
        <span className="flex items-end gap-1">
          <b className="text-[20px] leading-7 text-primary">
            {scoreText(overallScore)}
          </b>
          {overallScore != null ? (
            <span className="text-[12px] leading-4 text-[#8b95a1]">/ 100</span>
          ) : null}
        </span>
        <Image src="/figma/report/chevron.svg" alt="" width={18} height={18} />
      </button>

      {segments.length ? (
        <div className="space-y-3">
          <section className="rounded-[20px] bg-white px-5 py-4">
            <h2 className="text-[17px] leading-6 font-bold">이번 연습 결과</h2>
            <p className="mt-[3px] text-[13px] leading-[18px] text-[#8b95a1]">
              {segments.length}개 문장을 분석했어요
            </p>
            <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#eef0f3]">
              <span
                className="bg-[#f04f5f]"
                style={{ flexGrow: needsReview.length }}
              />
              <span
                className="bg-[#10a87b]"
                style={{ flexGrow: good.length }}
              />
              <span
                className="bg-[#98a2b2]"
                style={{ flexGrow: unavailable.length }}
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <StatusChip
                icon="warning"
                label="다시 확인"
                count={needsReview.length}
                tone="warning"
              />
              <StatusChip
                icon="check"
                label="잘 읽음"
                count={good.length}
                tone="check"
              />
              <StatusChip
                icon="info"
                label="분석 어려움"
                count={unavailable.length}
                tone="info"
              />
            </div>
          </section>

          <SegmentSection
            title="다시 확인해 보세요"
            items={needsReview}
            icon="warning"
            tone="warning"
            onSelect={(segment) => {
              setSelected(segment);
              setView("sentence");
            }}
          />
          <SegmentSection
            title="잘 읽은 문장"
            items={good}
            icon="check"
            tone="check"
            onSelect={(segment) => {
              setSelected(segment);
              setView("sentence");
            }}
          />
          <SegmentSection
            title="분석이 어려운 문장"
            items={unavailable}
            icon="info"
            tone="info"
            defaultOpen={false}
            onSelect={(segment) => {
              setSelected(segment);
              setView("sentence");
            }}
          />
        </div>
      ) : (
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
  );
}

function formatPoints(value: number) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const clamped = score == null ? 0 : Math.min(100, Math.max(0, score));
  return (
    <span
      className="flex size-[76px] shrink-0 items-center justify-center rounded-full p-1.5"
      style={{
        background: `conic-gradient(#2f6bff ${clamped}%, #eef0f3 0)`,
      }}
    >
      <span className="flex size-full items-center justify-center rounded-full bg-white">
        <b className="text-[20px] leading-7">{scoreText(score)}</b>
        {score != null ? (
          <span className="ml-px self-center pt-2 text-[11px] font-bold text-[#8b95a1]">
            점
          </span>
        ) : null}
      </span>
    </span>
  );
}

function StatusChip({
  icon,
  label,
  count,
  tone,
}: {
  icon: "warning" | "check" | "info";
  label: string;
  count: number;
  tone: "warning" | "check" | "info";
}) {
  const styles = {
    warning: "bg-[#fff2f3] text-[#f04f5f]",
    check: "bg-[#eefaf6] text-[#10a87b]",
    info: "bg-white text-[#4e5968]",
  };
  return (
    <span
      className={`flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[12px] leading-4 font-medium ${styles[tone]}`}
    >
      <ReportIcon name={icon} size={14} />
      {label} <b>{count}</b>
    </span>
  );
}

function SegmentSection({
  title,
  items,
  icon,
  tone,
  onSelect,
  defaultOpen = true,
}: {
  title: string;
  items: AnalysisSegment[];
  icon: "warning" | "check" | "info";
  tone: "warning" | "check" | "info";
  onSelect: (segment: AnalysisSegment) => void;
  defaultOpen?: boolean;
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
        <button
          key={String(segment.id)}
          type="button"
          onClick={() => onSelect(segment)}
          className="flex min-h-[56px] w-full items-start gap-3 pb-4 pt-1 text-left"
        >
          <span className="shrink-0 pt-0.5 text-[13px] leading-6 text-[#8b95a1]">
            {String(segment.sequenceNo).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1 text-[16px] leading-6 font-medium">
            {segmentText(segment)}
          </span>
          <Image
            src="/figma/report/chevron.svg"
            alt=""
            width={16}
            height={16}
            className="mt-1"
          />
        </button>
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
    <div className="fixed inset-0 z-[70] mx-auto flex h-dvh w-full max-w-[402px] flex-col bg-[#f2f4f6] pt-[max(44px,env(safe-area-inset-top,0px))] text-[#191f28]">
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
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
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
