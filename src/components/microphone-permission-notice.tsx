"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { useState } from "react";

const settings = registerPlugin<{ open(): Promise<void> }>(
  "PermissionSettings",
);

export function MicrophonePermissionNotice() {
  const [error, setError] = useState<string | null>(null);
  if (Capacitor.getPlatform() !== "android") return null;
  return (
    <div className="mx-5 my-3 rounded-2xl bg-white p-4 text-center">
      <p className="text-sm leading-5 text-[#4e5968]">
        앱 설정의 권한에서 마이크를 허용한 뒤 돌아와 다시 녹음해 주세요.
      </p>
      <button
        type="button"
        onClick={async () => {
          setError(null);
          try {
            await settings.open();
          } catch {
            setError(
              "설정을 열지 못했어요. 휴대전화 설정 > 앱 > Speak AI > 권한에서 마이크를 허용해 주세요.",
            );
          }
        }}
        className="mt-3 min-h-11 rounded-full bg-primary px-6 text-sm font-bold text-white"
      >
        마이크 권한 설정 열기
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs leading-5 text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
