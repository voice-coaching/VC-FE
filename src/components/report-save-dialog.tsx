"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./script-topic-picker.module.css";

/** Completion waits until the user's report retention choice has been persisted. */
export function ReportSaveDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (saveReport: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function choose(saveReport: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(saveReport);
      onOpenChange(false);
    } catch {
      setError("선택을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!inFlight.current) {
          setError(null);
          onOpenChange(next);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.modal}
          style={{ top: "50%" }}
          aria-busy={busy}
          onEscapeKeyDown={(event) => {
            if (inFlight.current) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (inFlight.current) event.preventDefault();
          }}
        >
          <Dialog.Title className={styles.modalTitle}>
            리포트를 저장할까요?
          </Dialog.Title>
          <Dialog.Description className={styles.description}>
            저장하면 이 기기의 저장 탭에서 다시 볼 수 있어요.
            <br />
            저장하지 않아도 녹음 기록은 남아요.
          </Dialog.Description>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void choose(false)}
            >
              저장 안 함
            </button>
            <button
              type="submit"
              disabled={busy}
              onClick={() => void choose(true)}
            >
              {busy ? "처리 중…" : "저장하기"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
