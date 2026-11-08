import type { BrowserVideoResult } from "@/lib/api/browser-video";

/** Display AI's final value; no phone measurements or client-side grading. */
export function LipScoreSummary({
  visual,
}: {
  visual: BrowserVideoResult["visual"];
}) {
  return (
    <section className="rounded-2xl bg-white p-5" aria-label="입술 점수">
      <h2 className="text-[17px] font-bold">입술 점수</h2>
      <p className="mt-2 text-lg font-bold">
        {visual.score !== null
          ? `${visual.score}점 / 100점`
          : "이번 촬영에서는 점수를 제공하기 어려워요."}
      </p>
      {visual.score !== null &&
        visual.scoreScope === "ASSESSED_PHONES_ONLY" && (
          <p className="mt-2 text-sm text-[#6b7684]">관찰된 부분 기준</p>
        )}
      {visual.score !== null && visual.scoreKind === "PROVISIONAL" && (
        <p className="mt-1 text-xs text-[#6b7684]">
          참조 영상과 비교한 임시 점수예요.
        </p>
      )}
    </section>
  );
}
