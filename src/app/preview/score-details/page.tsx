import { notFound } from "next/navigation";
import { ReportScoreHeadline } from "@/components/report-score";
import {
  AnalysisScoreDetails,
  ScoreCriteriaInfo,
} from "@/components/analysis-score-details";
import type { PublicScoreDetails } from "@/lib/score-details";

const criterion = (
  criterionId: PublicScoreDetails["criteria"][number]["criterionId"],
  label: string,
  score: number,
  weight: number,
) =>
  ({
    criterionId,
    label,
    score,
    weight,
    reasonCode: "OK",
    status: "SCORED",
  }) as const;

const details: PublicScoreDetails = {
  schemaVersion: "voice-coaching.score-details.v1",
  validationStatus: "EXPERT_REVIEW_PENDING",
  aggregationMode: "AUDIO_ONLY",
  audioScore: 67.5,
  visualScore: null,
  audioWeight: 100,
  visualWeight: 0,
  criteria: [
    criterion("pronunciation_accuracy", "발음 정확성", 87.5, 40),
    criterion("speaking_rate", "발음 속도", 48.8, 10),
    criterion("articulation_rate", "조음 속도", 54.1, 10),
    criterion("pauses", "쉼", 71.3, 10),
    criterion("pitch", "억양·음높이", 56.6, 15),
    criterion("intensity", "음량·강도", 43.7, 15),
  ],
};

/** Dev-only: the voice sub-score card with sample scores. */
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className="mx-auto min-h-dvh max-w-[402px] bg-[#f2f4f6] p-5">
      {/* Mirrors the "발음 분석" overlay card; the gauge is a stand-in. */}
      <section className="rounded-[20px] bg-white px-5 pt-5 pb-5">
        <ReportScoreHeadline
          score={67.5}
          title={
            <h2 className="flex items-center gap-0.5 text-sm leading-5 font-semibold text-[#4e5968]">
              종합 점수
              <ScoreCriteriaInfo details={details} />
            </h2>
          }
        />
        <div className="mt-3">
          <AnalysisScoreDetails details={details} embedded />
        </div>
      </section>
    </main>
  );
}
