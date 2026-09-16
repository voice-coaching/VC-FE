"use client";

import localFont from "next/font/local";
import type { CSSProperties, ReactNode } from "react";
import styles from "./iphone-frame.module.css";

const designFont = localFont({
  src: "../assets/fonts/NotoSansKR.woff",
  display: "swap",
  weight: "100 900",
});

export function IPhoneFrame({
  children,
  backgroundColor = "#fafbfc",
}: {
  children: ReactNode;
  backgroundColor?: string;
}) {
  return (
    <div
      className={`${designFont.className} ${styles.stage}`}
      style={
        {
          "--iphone-frame-background": backgroundColor,
        } as CSSProperties
      }
    >
      <div className={styles.screen}>{children}</div>
    </div>
  );
}
