"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function ScriptSavedToast({
  message,
  onPractice,
  onDismiss,
  busy,
}: {
  message: string;
  onPractice: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || busy) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [onDismiss, paused, busy]);
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setPaused(false);
      }}
      className="absolute right-5 bottom-[100px] left-5 z-30 flex items-center gap-3 rounded-[14px] bg-[#191f28]/[0.92] py-3.5 pr-4 pl-[18px] shadow-lg"
    >
      <Image src="/figma/my-script/saved.svg" alt="" width={18} height={18} />
      <p
        role="status"
        className="min-w-0 flex-1 text-[14px] leading-5 font-medium text-white"
      >
        {message}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onPractice}
        className="shrink-0 py-1 text-[14px] leading-5 font-bold text-[#7da3ff] disabled:opacity-50"
      >
        바로 연습
      </button>
    </div>
  );
}
