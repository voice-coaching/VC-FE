"use client";

import localFont from "next/font/local";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./iphone-frame.module.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
});

export function IPhoneFrame({ children }: { children: ReactNode }) {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fitDeviceToViewport = () => {
      const element = stage.current;
      if (!element) return;
      element.style.setProperty(
        "--device-scale",
        String(
          Math.max(
            0.1,
            Math.min(
              1,
              (window.innerWidth - 32) / 426,
              (window.innerHeight - 32) / 898,
            ),
          ),
        ),
      );
      const viewport = window.visualViewport;
      // Do not counteract the user's pinch zoom. Keyboard resizing remains supported.
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      element.style.setProperty(
        "--visible-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      element.style.setProperty(
        "--visible-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
    };

    fitDeviceToViewport();
    window.addEventListener("resize", fitDeviceToViewport);
    window.visualViewport?.addEventListener("resize", fitDeviceToViewport);
    window.visualViewport?.addEventListener("scroll", fitDeviceToViewport);
    return () => {
      window.removeEventListener("resize", fitDeviceToViewport);
      window.visualViewport?.removeEventListener("resize", fitDeviceToViewport);
      window.visualViewport?.removeEventListener("scroll", fitDeviceToViewport);
    };
  }, []);

  return (
    <div ref={stage} className={`${pretendard.className} ${styles.stage}`}>
      <div className={styles.device}>
        <div className={styles.screen}>{children}</div>
      </div>
    </div>
  );
}
