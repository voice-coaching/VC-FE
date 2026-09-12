import Image from "next/image";

/** Curves exported from the Figma lesson; these are prototype examples, not measured pitch. */
export function IntonationDiagram({
  type,
  result = false,
}: {
  type: "falling" | "rising" | "stress";
  result?: boolean;
}) {
  const falling = type === "falling";
  return (
    <div className="overflow-hidden rounded-2xl bg-white px-4 py-5 shadow-[0_2px_6px_rgba(23,23,23,0.05)]">
      <div
        role="img"
        aria-label={
          falling
            ? "문장 끝에서 내려가는 억양 곡선"
            : type === "rising"
              ? "문장 끝에서 올라가는 억양 곡선"
              : "핵심 단어에서 높아지는 억양 곡선"
        }
        className={`relative mx-auto w-full max-w-[320px] ${result ? "h-28" : "h-36"}`}
      >
        {falling ? (
          <>
            <div className="absolute top-[30px] right-2 left-2 border-t border-dashed border-[#e5e8eb]" />
            <Image
              src={`/figma/class/${result ? "result-area" : "pitch-area"}.svg`}
              alt=""
              width={288}
              height={76}
              className="absolute top-[22px] left-[5%] w-[90%]"
            />
            {result && (
              <Image
                src="/figma/class/result-reference.svg"
                alt=""
                width={288}
                height={46}
                className="absolute top-5 left-[5%] w-[90%]"
              />
            )}
            <Image
              src={`/figma/class/${result ? "result-mine" : "pitch-line"}.svg`}
              alt=""
              width={288}
              height={68}
              className="absolute top-[22px] left-[5%] w-[90%]"
            />
            {result && (
              <Image
                src="/figma/class/result-end.svg"
                alt=""
                width={12}
                height={12}
                className="absolute top-14 right-[3%] size-3"
              />
            )}
          </>
        ) : (
          <Image
            src={`/figma/class/${type}.svg`}
            alt=""
            fill
            className="object-fill px-4 pt-4 pb-10"
          />
        )}
        <div className="absolute right-2 bottom-1 left-2 flex justify-between text-[11px] text-[#8b95a1]">
          {(result && falling
            ? "오늘날씨가정말좋네요"
            : type === "falling"
              ? "정말좋네요"
              : type === "rising"
                ? "같이걸을까요"
                : "제가직접준비"
          )
            .split("")
            .map((letter, index, letters) => (
              <span
                key={index}
                className={
                  index === letters.length - 1 ? "font-bold text-[#2f6bff]" : ""
                }
              >
                {letter}
              </span>
            ))}
        </div>
      </div>
      {result ? (
        <p className="mt-3 text-[10px] text-[#8b95a1]">
          <span className="text-[#2f6bff]">━</span> 내 억양
          {falling && (
            <>
              　 <span>┄</span> 기준 억양
            </>
          )}
        </p>
      ) : (
        <p className="mt-4 inline-block rounded-full bg-[#edf2ff] px-3 py-1 text-xs font-bold text-[#2f6bff]">
          {falling
            ? "문장 끝 → 소리 낮추기"
            : type === "rising"
              ? "문장 끝 → 소리 올리기"
              : "핵심 단어 → 강조하기"}
        </p>
      )}
    </div>
  );
}
