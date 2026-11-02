"use client";
import type {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useState, useId } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { adminErrorMessage } from "../api";
import { useAdminCommand } from "../hooks";
import type { AdminPage } from "../types";
import styles from "../admin.module.css";

export const formatDate = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const labels: Record<string, string> = {
  ACTIVE: "활성",
  SUSPENDED: "이용 제한",
  WITHDRAWN: "탈퇴",
  USER: "일반 회원",
  ADMIN: "관리자",
  free: "무료",
  paid: "유료",
  admin: "테스트 이용등급",
  DRAFT: "초안",
  PUBLISHED: "공개",
  HIDDEN: "숨김",
  RECEIVED: "접수",
  IN_PROGRESS: "처리 중",
  ANSWERED: "답변 완료",
  CLOSED: "종료",
  SENT: "발송 완료",
  GENERAL: "일반 안내",
  PLAN: "요금제 안내",
  ALL_ACTIVE: "전체 활성 회원",
  SELECTED_USERS: "선택 회원",
  PRONUNCIATION: "발음",
  INTONATION: "억양",
  BOTH: "발음·억양",
  BEGINNER: "초급",
  INTERMEDIATE: "중급",
  ADVANCED: "고급",
  SENTENCE: "문장",
  NEWS: "뉴스",
  ANNOUNCER: "아나운서",
  CLASS_PRACTICE: "클래스 문장",
  TRAINING_SESSIONS: "학습 세션",
  RECORDINGS: "녹음",
  ANALYSES: "AI 분석",
  PAYMENTS: "테스트 결제",
  CANCELLATIONS: "취소·환불",
  INQUIRIES: "문의",
  NOTIFICATIONS: "알림",
  COURSE_PROGRESS: "클래스 진도",
  TITLES: "현재 칭호",
  TITLE_EXAMS: "승급 심사",
  DIRECT_ANALYSES: "직접 분석",
  COACHING_USAGE: "코칭 사용량",
  PRIVATE_CONTENTS: "개인 콘텐츠",
};
export const label = (value: string) => labels[value] ?? value;
export function Badge({ value }: { value: string }) {
  const color = [
    "ACTIVE",
    "PUBLISHED",
    "ANSWERED",
    "SENT",
    "SUCCEEDED",
    "COMPLETED",
  ].includes(value)
    ? styles.green
    : ["FAILED", "WITHDRAWN", "CLOSED"].includes(value)
      ? styles.red
      : ["DRAFT", "RECEIVED", "PENDING"].includes(value)
        ? styles.orange
        : styles.blue;
  return <span className={`${styles.badge} ${color}`}>{label(value)}</span>;
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.heading}>
      <div>
        <div className={styles.eyebrow}>SpeakAI 관리</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className={styles.actions}>{children}</div>
    </div>
  );
}
export function Panel({
  title,
  description,
  action,
  children,
  padded = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={styles.panel}>
      {title && (
        <div className={styles.panelHeader}>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={padded ? styles.panelBody : undefined}>{children}</div>
    </section>
  );
}
export function Button({
  children,
  primary = false,
  danger = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={`${styles.button} ${primary ? styles.primary : ""} ${danger ? styles.danger : ""} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}
export function ButtonLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${styles.button} ${primary ? styles.primary : ""}`}
    >
      {children}
    </Link>
  );
}
export function Message({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`${styles.notice} ${tone === "error" ? styles.error : tone === "success" ? styles.success : ""}`}
    >
      {tone === "success" ? (
        <CheckCircle2 size={17} />
      ) : (
        <AlertCircle size={17} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function LoadState({
  loading,
  error,
  empty = false,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  retry?: () => void;
}) {
  if (loading)
    return (
      <div className={styles.state} role="status">
        <LoaderCircle size={24} className="animate-spin" />
        불러오는 중입니다.
      </div>
    );
  if (error)
    return (
      <div className={styles.state}>
        <AlertCircle size={28} />
        <strong>정보를 불러오지 못했습니다</strong>
        <p role="alert">{adminErrorMessage(error)}</p>
        {retry && (
          <div className="mt-4">
            <Button onClick={retry}>다시 조회</Button>
          </div>
        )}
      </div>
    );
  if (empty)
    return (
      <div className={styles.state}>
        <Inbox size={28} />
        <strong>아직 등록된 항목이 없습니다</strong>
        <p>검색 조건을 바꾸거나 새 항목을 등록해 주세요.</p>
      </div>
    );
  return null;
}
export function Pager({
  data,
  onPage,
}: {
  data: AdminPage<unknown>;
  onPage: (page: number) => void;
}) {
  return (
    <div className={styles.pager}>
      <span>
        전체 <strong>{data.totalElements.toLocaleString()}</strong>건 ·{" "}
        {data.totalElements ? data.page + 1 : 0}/{data.totalPages} 페이지
      </span>
      <div className={styles.actions}>
        <Button
          disabled={data.page === 0}
          onClick={() => onPage(data.page - 1)}
          aria-label="이전 페이지"
        >
          <ChevronLeft size={15} />
        </Button>
        <Button
          disabled={!data.hasNext}
          onClick={() => onPage(data.page + 1)}
          aria-label="다음 페이지"
        >
          <ChevronRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function Field({
  label: fieldLabel,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <label className={styles.field}>
      <span id={`${id}-label`}>{fieldLabel}</span>
      <input
        {...props}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={styles.input}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function Textarea({
  label: fieldLabel,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <label className={styles.field}>
      <span id={`${id}-label`}>{fieldLabel}</span>
      <textarea
        {...props}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={styles.textarea}
      />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </label>
  );
}
export function Select({
  label: fieldLabel,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <label className={styles.field}>
      <span id={`${id}-label`}>{fieldLabel}</span>
      <select
        {...props}
        aria-labelledby={`${id}-label`}
        className={styles.select}
      >
        {children}
      </select>
    </label>
  );
}
export function Check({
  label: fieldLabel,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={styles.check}>
      <input {...props} type="checkbox" />
      {fieldLabel}
    </label>
  );
}
export function Reason() {
  return (
    <Textarea
      name="reason"
      label="작업 사유"
      maxLength={500}
      required
      rows={2}
      placeholder="변경 목적을 적어 주세요."
      hint="감사 기록에 남습니다. 개인정보·토큰·원문을 넣지 마세요."
    />
  );
}
export function CommandFeedback({
  command,
}: {
  command: ReturnType<typeof useAdminCommand>;
}) {
  return (
    <>
      {command.error && <Message tone="error">{command.error}</Message>}
      {command.success && <Message tone="success">{command.success}</Message>}
    </>
  );
}
/** A reason and explicit confirmation are required before publishing, dispatching or changing status. */
export function ConfirmAction({
  title,
  description,
  buttonLabel,
  action,
  primary = false,
  danger = false,
  onDone,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  action: (reason: string) => Promise<unknown>;
  primary?: boolean;
  danger?: boolean;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const command = useAdminCommand();
  return (
    <>
      <Button primary={primary} danger={danger} onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!command.busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const reason = String(
                new FormData(event.currentTarget).get("reason") ?? "",
              );
              void command.run(
                () => action(reason),
                () => {
                  setOpen(false);
                  onDone?.();
                },
              );
            }}
          >
            <Reason />
            <CommandFeedback command={command} />
            <div className={styles.actions}>
              <Button onClick={() => setOpen(false)} disabled={command.busy}>
                돌아가기
              </Button>
              <Button
                type="submit"
                primary={primary}
                danger={danger}
                disabled={command.busy}
              >
                {command.busy ? "처리 중…" : buttonLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function DetailList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className={styles.detailList}>
      {items.map(([name, value]) => (
        <div key={name} style={{ display: "contents" }}>
          <dt>{name}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
