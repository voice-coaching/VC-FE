"use client";

import localFont from "next/font/local";
import type { ReactNode } from "react";
import styles from "./iphone-frame.module.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
});

export function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className={`${pretendard.className} ${styles.stage}`}>
      <div className={styles.screen}>{children}</div>
    </div>
  );
}
