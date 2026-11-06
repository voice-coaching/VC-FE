"use client";

import Image from "next/image";

export function PracticeAnalysisFailure({
  onRetry,
  onReturn,
}: {
  onRetry: () => void;
  onReturn: () => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f2f4f6]">
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <Image
          src="/figma/analysis-screen7/failed.png"
          alt=""
          width={140}
          height={140}
          className="size-[140px] object-cover"
        />
        <h2 className="mt-5 text-xl leading-7 font-bold text-[#191f28]">
          분석에 실패했어요
        </h2>
        <p className="mt-2 text-sm leading-5 font-medium text-[#8b95a1]">
          네트워크 연결을 확인하고 다시 시도해 주세요
          <br />
          녹음은 그대로 남아 있어요
        </p>
      </div>
      <div className="flex flex-col gap-2.5 bg-white px-5 pt-3 pb-9">
        <button
          onClick={onRetry}
          className="h-14 rounded-full bg-[#6346f6] text-base font-bold text-white"
        >
          다시 시도
        </button>
        <button
          onClick={onReturn}
          className="h-14 rounded-full border border-[#e5e8eb] bg-white text-base font-bold text-[#191f28]"
        >
          녹음 확인으로 돌아가기
        </button>
      </div>
    </div>
  );
}
