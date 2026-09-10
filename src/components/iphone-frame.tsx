"use client";

import localFont from "next/font/local";
import { useEffect, useState, type ReactNode } from "react";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
});

export function IPhoneFrame({ children }: { children: ReactNode }) {
  const [deviceScale, setDeviceScale] = useState(1);

  useEffect(() => {
    const fitDeviceToViewport = () => {
      setDeviceScale(
        Math.min(
          1,
          (window.innerWidth - 32) / 426,
          (window.innerHeight - 32) / 898,
        ),
      );
    };

    fitDeviceToViewport();
    window.addEventListener("resize", fitDeviceToViewport);
    return () => window.removeEventListener("resize", fitDeviceToViewport);
  }, []);

  return (
    <div
      className={`${pretendard.className} relative h-dvh overflow-hidden bg-[#8b8b8b] text-[#191f28]`}
    >
      <main
        className="absolute top-1/2 left-1/2 h-[898px] w-[426px] origin-center rounded-[58px] bg-[#090909] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        style={{ transform: `translate(-50%, -50%) scale(${deviceScale})` }}
      >
        <div className="h-[874px] w-[402px] overflow-hidden rounded-[46px] bg-white">
          {children}
        </div>
      </main>
    </div>
  );
}
