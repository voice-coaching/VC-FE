"use client";
import { useEffect, useState } from "react";
import { PopupPicture } from "@/components/popup-picture";
import { useAdminCommand } from "../hooks";
import {
  uploadPopupImage,
  removePopupImage,
  validatePopupImage,
} from "../popup-images";
import type { Popup } from "../types";
import {
  Panel,
  Message,
  Field,
  Button,
  Textarea,
  CommandFeedback,
  ConfirmAction,
} from "./shared";
import styles from "../admin.module.css";

export function PopupImagePanel({
  current,
  dirty = false,
  onBusyChange,
}: {
  current?: Popup;
  dirty?: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const command = useAdminCommand(["/popups", "/audit-logs"]);
  useEffect(() => {
    onBusyChange(command.busy);
    return () => onBusyChange(false);
  }, [command.busy, onBusyChange]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disabled = !current || dirty || command.busy;
  return (
    <Panel title="팝업 이미지" padded>
      <Message>
        PNG·JPEG, 최대 3MB. 팝업이 만료되면 이미지도 자동 삭제됩니다. 기간을
        연장하면 삭제 예정일도 함께 연장됩니다.
      </Message>
      {!current && (
        <Message>먼저 팝업을 저장한 뒤 이미지를 첨부해 주세요.</Message>
      )}
      {dirty && (
        <Message>
          편집 중인 팝업 설정을 먼저 저장한 뒤 이미지를 변경해 주세요.
        </Message>
      )}
      {current?.image && (
        <PopupPicture
          key={current.image.url}
          image={current.image}
          title={current.title}
        />
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (!current || !file) return;
          const reason = String(
            new FormData(event.currentTarget).get("reason") ?? "",
          );
          void command.run(() => uploadPopupImage(current, file, reason));
        }}
      >
        <fieldset disabled={disabled} className={styles.form}>
          <Field
            type="file"
            label="이미지 파일"
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setError(null);
              setFile(null);
              if (selected)
                try {
                  validatePopupImage(selected);
                  setFile(selected);
                } catch (e) {
                  setError((e as Error).message);
                }
            }}
          />
          {file && <p>{file.name}</p>}
          <Textarea
            name="reason"
            label="이미지 변경 사유"
            required
            maxLength={500}
            rows={2}
          />
          {error && <Message tone="error">{error}</Message>}
          <CommandFeedback command={command} />
          <Button primary type="submit" disabled={disabled || !file}>
            {command.busy
              ? "이미지 저장 중…"
              : current?.image
                ? "이미지 교체"
                : "이미지 첨부"}
          </Button>
        </fieldset>
      </form>
      {current?.image && (
        <ConfirmAction
          title="팝업 이미지 첨부를 해제할까요?"
          description="팝업 문구는 유지하며 기존 이미지 파일은 자동 정리됩니다."
          buttonLabel="이미지 해제"
          disabled={disabled}
          invalidationPaths={["/popups", "/audit-logs"]}
          action={async (reason) => {
            onBusyChange(true);
            try {
              return await removePopupImage(current, reason);
            } finally {
              onBusyChange(false);
            }
          }}
        />
      )}
    </Panel>
  );
}
