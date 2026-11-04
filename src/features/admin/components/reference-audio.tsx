"use client";
import { useEffect, useState } from "react";
import { Mic, Play } from "lucide-react";
import { useAdminQuery, useAdminCommand } from "../hooks";
import { adminApi } from "../api";
import {
  uploadAnnouncerAudio,
  resumeAnnouncerUpload,
  type AudioUploadAttempt,
  registerAnnouncerAudio,
  makePrimary,
  deleteReferenceAudio,
} from "../services";
import type { AudioList, AudioRegistration, Content } from "../types";
import {
  Panel,
  Badge,
  Button,
  Field,
  Check,
  Reason,
  CommandFeedback,
  LoadState,
  ConfirmAction,
  Message,
  formatDate,
} from "./shared";
import styles from "../admin.module.css";
export function AudioPanel({ content }: { content: Content }) {
  const audios = useAdminQuery<AudioList>(
    `/contents/${content.id}/reference-audios`,
  );
  const command = useAdminCommand(["/contents", "/audit-logs"]);
  const playback = useAdminCommand([]);
  const [pending, setPending] = useState<AudioUploadAttempt | null>(null);
  const [preview, setPreview] = useState<{
    audioId: number;
    playbackUrl: string;
    expiresAt: string;
  } | null>(null);
  useEffect(() => {
    if (!preview) return;
    const timer = setTimeout(
      () => setPreview(null),
      Math.max(0, Date.parse(preview.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [preview]);
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
  return (
    <div className={styles.grid}>
      <Panel
        title="기준 음성"
        description="문장과 발화 내용이 일치하는지 미리 들어 확인하세요."
        padded
      >
        <LoadState
          loading={audios.isPending}
          error={audios.error}
          empty={audios.data?.items.length === 0}
          retry={() => void audios.refetch()}
        />
        {audios.data?.items.map((audio) => (
          <div key={audio.audioId} className={`${styles.sectionEditor} mb-3`}>
            <div className={styles.sectionHeader}>
              <span>
                {audio.speakerName}{" "}
                <span className={styles.muted}>#{audio.audioId}</span>
              </span>
              {audio.primary && <Badge value="대표 음성" />}
            </div>
            <p className={styles.muted}>
              {audio.durationMs === null
                ? "기존 음성 · 길이 미등록"
                : `${(audio.durationMs / 1000).toFixed(1)}초`}{" "}
              · {formatDate(audio.createdAt)}
            </p>
            <div className={styles.actions}>
              <Button
                disabled={playback.busy}
                onClick={() =>
                  void playback.run(
                    () =>
                      adminApi.read<{
                        audioId: number;
                        playbackUrl: string;
                        expiresAt: string;
                      }>(`/reference-audios/${audio.audioId}/playback-url`),
                    setPreview,
                  )
                }
              >
                <Play size={13} />
                미리듣기
              </Button>
              {!audio.primary && (
                <ConfirmAction
                  invalidationPaths={["/contents", "/audit-logs"]}
                  title="대표 음성으로 지정할까요?"
                  description="사용자에게 제공되는 기본 기준 음성이 변경됩니다."
                  buttonLabel="대표 음성 지정"
                  action={(reason) =>
                    makePrimary(
                      {
                        ...audio,
                        contentVersion:
                          audios.data?.contentVersion ?? audio.contentVersion,
                      },
                      reason,
                    )
                  }
                />
              )}
              <ConfirmAction
                invalidationPaths={[
                  "/contents",
                  "/reference-audios",
                  "/audit-logs",
                ]}
                title="이 기준 음성을 삭제할까요?"
                description={
                  audio.primary
                    ? "대표 음성을 삭제하면 남은 음성 중 하나가 대표가 됩니다. 마지막 음성을 삭제하면 기준 음성이 없는 상태가 됩니다. 기존 학습 기록과 원본 파일은 보존됩니다."
                    : "기준 음성 목록에서 제외하고 새 재생을 중단합니다. 기존 학습 기록과 원본 파일은 보존됩니다."
                }
                buttonLabel="음성 삭제"
                danger
                disabled={
                  command.busy ||
                  playback.busy ||
                  !!pending ||
                  audios.isFetching
                }
                action={(reason) =>
                  deleteReferenceAudio(
                    {
                      ...audio,
                      contentVersion:
                        audios.data?.contentVersion ?? audio.contentVersion,
                    },
                    reason,
                  )
                }
                onDone={() => {
                  setPreview(null);
                  playback.clearFeedback();
                }}
              />
            </div>
            {preview?.audioId === audio.audioId && (
              <audio
                className={styles.audio}
                controls
                preload="none"
                crossOrigin="anonymous"
                src={preview.playbackUrl}
                onError={() => setPreview(null)}
              >
                음성 재생을 지원하지 않는 브라우저입니다.
              </audio>
            )}
          </div>
        ))}
        <CommandFeedback command={playback} />
      </Panel>
      <Panel
        title="새 기준 음성 등록"
        description="MP3 또는 AAC M4A · 최대 20MiB, 0.5~180초"
        padded
      >
        <Message>
          원본 파일을 업로드한 뒤 서버 검증을 거쳐 연결합니다. 음성 등록은 문장
          공개와 별도입니다.
        </Message>
        <form
          aria-label="기준 음성 등록"
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const file = data.get("audio");
            if (!(file instanceof File) || file.size === 0) return;
            void command.run(
              () =>
                uploadAnnouncerAudio(
                  {
                    ...content,
                    version: audios.data?.contentVersion ?? content.version,
                  },
                  file,
                  data,
                  setPending,
                ),
              () => setPending(null),
            );
          }}
        >
          <fieldset
            className={styles.form}
            disabled={command.busy || !!pending}
          >
            <Field
              type="file"
              name="audio"
              label="음성 파일"
              accept=".mp3,.m4a,audio/mpeg,audio/mp4"
              required
            />
            <Field
              name="speakerName"
              label="화자 표시명"
              placeholder="전문 아나운서"
              maxLength={255}
              required
            />
            <Check
              name="primary"
              label="이 음성을 대표 음성으로 지정"
              defaultChecked
            />
            <Reason />
            <Button
              type="submit"
              primary
              disabled={command.busy || !audios.data}
            >
              <Mic size={15} />
              {command.busy ? "업로드·검증 중…" : "업로드하고 등록"}
            </Button>
          </fieldset>
        </form>
        <CommandFeedback command={command} />
        {pending && (
          <Message>
            같은 업로드 ID로 등록을 확인할 수 있습니다. 화면을 닫으면 이 복구
            정보가 사라집니다.
            <div className="mt-3">
              <Button
                disabled={command.busy}
                onClick={() =>
                  void command.run(
                    () =>
                      registerAnnouncerAudio(content.id, pending.registration),
                    () => setPending(null),
                  )
                }
              >
                같은 업로드 등록 확인·재시도
              </Button>
              <Button
                disabled={command.busy}
                onClick={() =>
                  void command.run(
                    () => resumeAnnouncerUpload(pending),
                    () => setPending(null),
                  )
                }
              >
                같은 파일 재전송·등록
              </Button>
              <Button disabled={command.busy} onClick={() => setPending(null)}>
                목록 확인 후 새 업로드 준비
              </Button>
            </div>
          </Message>
        )}
      </Panel>
    </div>
  );
}
