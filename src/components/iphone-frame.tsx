"use client";

import localFont from "next/font/local";
import type { ReactNode } from "react";
import styles from "./iphone-frame.module.css";

const designFont = localFont({
  src: "../assets/fonts/NotoSansKR.woff",
  display: "swap",
  weight: "100 900",
});

export function IPhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className={`${designFont.className} ${styles.stage}`}>
      <div className={styles.screen}>{children}</div>
    </div>
  );
}
