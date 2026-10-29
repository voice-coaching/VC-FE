"use client";

import { useRef } from "react";
import styles from "./script-text-input.module.css";

export function ScriptTextInput({
  value,
  onChange,
  limit,
}: {
  value: string;
  onChange: (value: string) => void;
  limit: number;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const characters = Array.from(value);
  const invalid = characters.length > limit;
  return (
    <div className={styles.field} data-invalid={invalid}>
      <div ref={backdrop} aria-hidden="true" className={styles.highlight}>
        {characters.slice(0, limit).join("")}
        <span>{characters.slice(limit).join("")}</span>
        {"\n"}
      </div>
      <textarea
        id="custom-script"
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (backdrop.current)
            backdrop.current.scrollTop = event.currentTarget.scrollTop;
        }}
        aria-invalid={invalid}
        aria-describedby="custom-script-count custom-script-help"
        placeholder="여기에 원고를 붙여넣어 주세요"
        spellCheck={false}
      />
    </div>
  );
}
