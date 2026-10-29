"use client";
import * as Dialog from "@radix-ui/react-dialog";
import styles from "./script-topic-picker.module.css";
export function ScriptConfirmDialog({
  open,
  title,
  description,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.modal}
          style={{ top: "50%" }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Dialog.Title className={styles.modalTitle}>{title}</Dialog.Title>
          <Dialog.Description className={styles.description}>
            {description}
          </Dialog.Description>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button disabled={busy} onClick={onConfirm}>
              {busy ? "삭제 중…" : "삭제"}
            </button>
            <button type="submit" autoFocus disabled={busy} onClick={onClose}>
              취소
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
