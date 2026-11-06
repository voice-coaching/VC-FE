"use client";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type RefObject } from "react";
import styles from "./lip-quick-start.module.css";
export type LipPermission = "request" | "both" | "camera" | "microphone";
export function LipPermissionDialog({
  state,
  onClose,
  onAllow,
  busy = false,
}: {
  state: LipPermission | null;
  onClose: () => void;
  onAllow: () => void;
  busy?: boolean;
}) {
  const [help, setHelp] = useState(false);
  const request = state === "request";
  const title = request
    ? "카메라와 마이크를 켜 주세요"
    : state === "camera"
      ? "카메라가 꺼져 있어요"
      : state === "microphone"
        ? "마이크가 꺼져 있어요"
        : "카메라와 마이크가 꺼져 있어요";
  return (
    <Dialog.Root
      open={state !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setHelp(false);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.modal}
          aria-describedby={request ? undefined : "lip-permission-description"}
        >
          <Dialog.Title style={{ textAlign: request ? "left" : "center" }}>
            {title}
          </Dialog.Title>
          {request ? (
            <div className={styles.permissionList}>
              {[
                ["camera.svg", "카메라", "내 입모양을 기준과 비교해요"],
                ["mic.svg", "마이크", "소리가 맞게 났는지 확인해요"],
              ].map(([icon, label, description]) => (
                <div key={label}>
                  <span className={styles.permissionIcon}>
                    <Image
                      src={`/figma/lip-quick-start/${icon}`}
                      width={18}
                      height={18}
                      alt=""
                    />
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Dialog.Description
              id="lip-permission-description"
              className={styles.modalDescription}
            >
              {help
                ? "주소창 옆 사이트 설정에서 카메라와 마이크를 허용한 뒤 다시 시도해 주세요."
                : state === "camera"
                  ? "입모양을 비교하려면\n카메라가 필요해요"
                  : state === "microphone"
                    ? "소리까지 확인하려면\n마이크가 필요해요"
                    : "설정에서 두 권한을 켜면\n바로 연습할 수 있어요"}
            </Dialog.Description>
          )}
          <div className={styles.modalButtons}>
            <button
              disabled={busy}
              onClick={() => {
                setHelp(false);
                onClose();
              }}
            >
              {request ? "나중에" : "닫기"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (request || help) onAllow();
                else setHelp(true);
              }}
            >
              {busy
                ? "확인 중…"
                : request
                  ? "허용하기"
                  : help
                    ? "다시 확인"
                    : "설정으로 이동"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function LipFaceAlignment({
  onClose,
  onReady,
  videoRef,
  mirrored = true,
}: {
  onClose: () => void;
  onReady: () => void;
  videoRef?: RefObject<HTMLVideoElement | null>;
  mirrored?: boolean;
}) {
  return (
    <div className={styles.align}>
      {videoRef && (
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        />
      )}
      <header className={styles.alignHeader}>
        <button aria-label="촬영 준비 닫기" onClick={onClose}>
          <Image
            src="/figma/lip-quick-start/camera-close.svg"
            width={24}
            height={24}
            alt=""
          />
        </button>
      </header>
      <main className={styles.alignStage}>
        <div className={styles.alignHead}>
          <h1>얼굴 맞추기</h1>
          <p>가이드 안에 얼굴을 맞추고 시작해 주세요</p>
        </div>
        <Image
          src="/figma/lip-quick-start/face-guide.svg"
          width={268}
          height={268}
          alt="얼굴 위치 가이드"
        />
      </main>
      <footer className={styles.alignFooter}>
        <p>촬영이 끝날 때까지 자세를 유지해 주세요</p>
        <button className={styles.action} onClick={onReady}>
          준비됐어요
        </button>
      </footer>
    </div>
  );
}
