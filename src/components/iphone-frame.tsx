"use client";

import type { CSSProperties, ReactNode } from "react";
import styles from "./iphone-frame.module.css";

export function IPhoneFrame({
  children,
  backgroundColor = "#f5f6f8",
}: {
  children: ReactNode;
  backgroundColor?: string;
}) {
  return (
    <div
      className={styles.stage}
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
