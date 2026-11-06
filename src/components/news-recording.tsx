"use client";
import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Mic, Play } from "lucide-react";
import { referencePlayback } from "@/lib/audio-playback";
import { GuidePlayer } from "./guide-player";
import { MicrophonePermissionNotice } from "./microphone-permission-notice";
import { RecordingWaveform } from "./recording-waveform";
import type { SentenceRecordingControls } from "./sentence-recording-controls";
import styles from "./news-recording.module.css";

function useGuidePlaying() {
  return useSyncExternalStore(
    referencePlayback.subscribe,
    () => referencePlayback.getSnapshot() !== null,
    () => false,
  );
}

export function NewsRecordingReader({
  sentences,
  active,
  recording,
  label = "뉴스 읽기",
}: {
  sentences: string[];
  active: number;
  recording: boolean;
  estimatedSeconds?: number;
  label?: string;
}) {
  const playing = useGuidePlaying();
  const current = useRef<HTMLLIElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = current.current;
    const viewport = reader.current;
    if (!row || !viewport) return;
    const bounds = row.getBoundingClientRect();
    const container = viewport.getBoundingClientRect();
    if (bounds.bottom > container.bottom)
      viewport.scrollBy({
        top: bounds.bottom - container.bottom,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    else if (bounds.top < container.top)
      viewport.scrollBy({
        top: bounds.top - container.top,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [active]);
  return (
    <>
      <div className="flex shrink-0 items-center px-5 pt-3 pb-4">
        <span className="rounded-full bg-[#f0edff] px-2.5 py-[5px] text-xs leading-4 font-medium text-[#6346f6]">
          {label}
        </span>
        <span className="ml-auto text-[13px] leading-[18px] text-[#8b95a1]">
          {playing ? (
            <span className="inline-flex items-center gap-1 text-[#6346f6]">
              <Image
                src="/figma/record-screen7/headphones-purple.svg"
                alt=""
                width={14}
                height={14}
              />
              가이드 듣는 중
            </span>
          ) : recording ? (
            <>
              <strong className="text-[#6346f6]">{active + 1}</strong>/
              {sentences.length} 문장
            </>
          ) : (
            <>{sentences.length}문장</>
          )}
        </span>
      </div>
      <div
        ref={reader}
        role="region"
        aria-label="연습 문장"
        className="mx-5 min-h-0 max-h-[45dvh] shrink-0 overflow-y-auto rounded-[16px] bg-white p-2 shadow-[0_2px_6px_rgba(23,23,23,0.05)]"
      >
        <ol className="space-y-0.5">
          {sentences.map((text, index) => (
            <li
              key={index}
              ref={index === active ? current : undefined}
              aria-current={recording && index === active ? "step" : undefined}
              className={styles.sentenceRow}
              data-active={recording && index === active}
              data-complete={recording && index < active}
              data-upcoming={recording && index > active}
            >
              <span className={styles.sentenceIndicator} aria-hidden="true" />
              <p className={styles.sentenceText}>{text}</p>
              <Image
                className={styles.sentenceCheck}
                src="/figma/record-screen7/check-purple.svg"
                alt={recording && index < active ? "녹음 완료" : ""}
                aria-hidden={!(recording && index < active)}
                width={20}
                height={20}
              />
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}

export function NewsRecordingControls(
  props: ComponentProps<typeof SentenceRecordingControls> & {
    preview?: boolean;
  },
) {
  const {
    recording,
    paused,
    busy,
    requesting,
    onTogglePause,
    onStart,
    onComplete,
    last,
    elapsed,
    stream,
    contentId,
    referenceAvailable,
    scriptText,
  } = props;
  const playing = useGuidePlaying();
  const autoPaused = useRef(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  useEffect(() => {
    if (!recording) {
      autoPaused.current = false;
      return;
    }
    if (playing && !paused) {
      autoPaused.current = true;
      onTogglePause();
    } else if (!playing && autoPaused.current) {
      autoPaused.current = false;
      if (paused) onTogglePause();
    }
  }, [playing, paused, recording, onTogglePause]);
  async function requestStart() {
    if (props.preview) {
      onStart();
      return;
    }
    setPermissionBlocked(false);
    try {
      const permission = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      if (permission.state === "denied") {
        setPermissionBlocked(true);
        setPermissionOpen(true);
        return;
      }
      if (permission.state === "granted") {
        onStart();
        return;
      }
    } catch {}
    setPermissionOpen(true);
  }
  return (
    <section
      aria-label="문장 녹음 조작"
      className={styles.controls}
      data-recording={recording}
      data-playing={playing}
      data-capturing={recording && !paused && !playing && !busy}
    >
      <div className={styles.glowLayer} aria-hidden="true">
        <div className={styles.glow} />
      </div>
      {recording && (
        <div className={styles.meter}>
          {props.preview ? (
            <div
              className={styles.previewWave}
              data-active={!paused && !playing && !busy}
              aria-hidden="true"
            >
              {Array.from({ length: 20 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    animationDelay: `-${index * 137}ms`,
                    animationDuration: `${650 + (index % 5) * 110}ms`,
                  }}
                />
              ))}
            </div>
          ) : (
            <RecordingWaveform
              stream={stream}
              paused={paused || playing || busy}
            />
          )}
          <p
            role="timer"
            aria-label="녹음 시간"
            className="flex items-center justify-center gap-2 text-[15px] leading-[22px] font-bold tabular-nums"
          >
            <span
              className={`size-2 rounded-full ${paused || playing ? "bg-[#b0b8c1]" : "bg-[#e32239]"}`}
            />
            {elapsed}
          </p>
        </div>
      )}
      <div className={styles.buttons}>
        <div className={styles.guide} data-playing={playing}>
          <GuidePlayer
            contentId={contentId}
            available={referenceAvailable}
            text={scriptText}
            variant="guide"
            title="가이드 듣기"
            disabled={requesting}
          />
          <span className={styles.guideLabel}>
            {playing ? "가이드 멈추기" : "가이드 듣기"}
          </span>
        </div>
        {recording && (
          <button
            className={styles.small}
            data-active={!paused && !playing && !busy}
            type="button"
            disabled={busy || playing}
            onClick={onTogglePause}
            aria-label={paused && !playing ? "녹음 재개" : "녹음 일시정지"}
          >
            <span className={styles.smallCircle}>
              {paused && !playing ? (
                <Play size={24} fill="currentColor" strokeWidth={0} />
              ) : (
                <span className={styles.stopIcon} />
              )}
            </span>
            <span>{paused && !playing ? "녹음하기" : "멈추기"}</span>
          </button>
        )}
        <button
          type="button"
          className={styles.primary}
          disabled={
            requesting || playing || (recording && (busy || (paused && !last)))
          }
          onClick={recording ? onComplete : () => void requestStart()}
        >
          <span className={styles.primaryCircle}>
            {!recording ? (
              <Mic
                size={28}
                fill="none"
                className="[&_rect]:fill-current"
                strokeWidth={2}
                aria-hidden="true"
              />
            ) : (
              <Image
                src={
                  last
                    ? "/figma/record-screen7/check-white.svg"
                    : "/figma/record-controls/next.svg"
                }
                alt=""
                width={recording && !last ? 28 : 20}
                height={recording && !last ? 28 : 20}
              />
            )}
          </span>
          <span>
            {requesting
              ? "준비 중…"
              : !recording
                ? "녹음 시작"
                : last
                  ? "끝내기"
                  : "다음 문장"}
          </span>
        </button>
      </div>
      <Dialog.Root open={permissionOpen} onOpenChange={setPermissionOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-40px)] max-w-[342px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-white px-5 pt-7 pb-5 text-center shadow-xl">
            <Image
              src="/figma/record-screen7/permission-mic.svg"
              alt=""
              width={35.442}
              height={48}
              className="mx-auto mb-3"
            />
            <Dialog.Title className="text-xl leading-7 font-bold">
              {permissionBlocked
                ? "마이크 사용이 차단되어 있어요"
                : "마이크를 켜 주세요"}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-5 font-medium text-[#6b7684]">
              말하기 연습과 발음 분석을 위해
              <br />
              마이크 권한이 필요해요
            </Dialog.Description>
            {permissionBlocked && <MicrophonePermissionNotice />}
            <div className="mt-6 flex gap-2">
              <Dialog.Close className="h-14 w-[120px] rounded-full border border-[#e5e8eb] font-bold">
                나중에
              </Dialog.Close>
              <button
                className="h-14 flex-1 rounded-full bg-[#6346f6] font-bold text-white"
                onClick={() => {
                  setPermissionOpen(false);
                  onStart();
                }}
              >
                {permissionBlocked ? "다시 시도" : "허용하기"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
