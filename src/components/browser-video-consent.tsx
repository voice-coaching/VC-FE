"use client";

/** This consent covers the original video and its embedded audio, before requesting an upload grant. */
export function BrowserVideoConsent({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}) {
  return (
    <section
      className="mt-4 space-y-3 text-sm"
      aria-label="영상 분석 및 처리 안내"
    >
      <p className="text-xs leading-5 text-muted-foreground">
        분석을 요청하면 선택한 원본 영상과 내장 음성을 AI 서버로 직접 전송해
        발음과 입술 움직임을 분석합니다. 참조 자료와 관측 범위에 따라 입술
        점수는 제공되지 않을 수 있어요.
      </p>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-6 shrink-0 accent-[#6346f6]"
          checked={accepted}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>
          원본 영상·내장 음성의 AI 전송 및 발음·입술 분석 처리에 동의합니다.
        </span>
      </label>
      <p className="text-xs leading-5 text-muted-foreground">
        동의하지 않아도 촬영본을 기기에서 확인할 수 있어요.
      </p>
    </section>
  );
}
