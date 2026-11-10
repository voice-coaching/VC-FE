"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminCommand, useAdminQuery } from "../hooks";
import {
  policyListSchema,
  saveTitleExamPolicy,
  type TitleExamPolicy,
} from "../title-exam-policies";
import {
  Heading,
  Panel,
  Button,
  ButtonLink,
  Field,
  Textarea,
  LoadState,
  Message,
  Reason,
  CommandFeedback,
} from "./shared";
import styles from "../admin.module.css";

export function TitleExamPoliciesPage() {
  const query = useAdminQuery<unknown>("/title-exam-policies");
  const parsed =
    query.data === undefined ? null : policyListSchema.safeParse(query.data);
  return (
    <>
      <Heading
        title="승급 시험 관리"
        description="목표 칭호별 시험 문장과 합격 점수를 설정하세요."
      />
      <Message>
        각 등급의 설정 변경에서 시험 문장과 합격 점수를 수정할 수 있습니다.
        변경한 설정은 새로 생성하는 시험부터 적용됩니다. 응시 횟수 정책은
        변경하지 않습니다.
      </Message>
      <LoadState
        loading={query.isPending}
        error={
          query.error ??
          (parsed && !parsed.success
            ? new Error("시험 설정 응답을 확인하지 못했습니다.")
            : null)
        }
        retry={() => void query.refetch()}
        empty={parsed?.success && parsed.data.items.length === 0}
      />
      {parsed?.success &&
        !query.error &&
        parsed.data.items.map((policy) => (
          <Panel
            key={policy.targetRank}
            title={`${policy.targetTitle} 승급 시험`}
            padded
          >
            <p>
              합격 기준: <strong>{policy.passingScore}점 이상</strong>
            </p>
            <p>시험 문장: {policy.content?.title ?? "연결된 문장 없음"}</p>
            {policy.available ? (
              <p className="whitespace-pre-wrap">
                {policy.content?.scriptText}
              </p>
            ) : (
              <Message tone="error">
                현재 문제는 시험에 사용할 수 없습니다. 공개된 시험 문장을 다시
                연결해 주세요.
              </Message>
            )}
            <ButtonLink href={`/admin/title-exams/${policy.targetRank}`}>
              설정 변경
            </ButtonLink>
          </Panel>
        ))}
    </>
  );
}

export function TitleExamPolicyEditPage({
  targetRank,
}: {
  targetRank: TitleExamPolicy["targetRank"];
}) {
  const router = useRouter();
  const query = useAdminQuery<unknown>("/title-exam-policies");
  const parsed =
    query.data === undefined ? null : policyListSchema.safeParse(query.data);
  const policy = parsed?.success
    ? parsed.data.items.find((item) => item.targetRank === targetRank)
    : undefined;
  return (
    <>
      <Heading
        title="승급 시험 설정 변경"
        description="선택한 등급의 시험 문장과 합격 점수를 수정하세요."
      >
        <ButtonLink href="/admin/title-exams">목록으로</ButtonLink>
      </Heading>
      <LoadState
        loading={query.isPending}
        error={
          query.error ??
          (parsed && !parsed.success
            ? new Error("시험 설정 응답을 확인하지 못했습니다.")
            : null)
        }
        retry={() => void query.refetch()}
      />
      {parsed?.success &&
        !query.error &&
        (policy ? (
          <PolicyEditor
            key={targetRank}
            initial={policy}
            onClose={() => router.push("/admin/title-exams")}
          />
        ) : (
          <Message tone="error">
            해당 승급 시험 설정을 찾지 못했습니다. 목록으로 돌아가 다시 선택해
            주세요.
          </Message>
        ))}
    </>
  );
}

function PolicyEditor({
  initial,
  onClose,
}: {
  initial: TitleExamPolicy;
  onClose: () => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    editor.current?.focus({ preventScroll: true });
    editor.current?.scrollIntoView({ block: "start" });
  }, []);
  // Keep the version shown when editing began; background reads cannot overwrite unsaved changes.
  const [baseline] = useState(initial);
  const selected = baseline.available ? baseline.content : null;
  const [scriptText, setScriptText] = useState(selected?.scriptText ?? "");
  const command = useAdminCommand([
    "/title-exam-policies",
    "/contents",
    "/audit-logs",
  ]);
  return (
    <div
      ref={editor}
      role="region"
      aria-label={`${baseline.targetTitle} 시험 설정 변경`}
      tabIndex={-1}
    >
      <Panel title={`${baseline.targetTitle} 시험 설정 변경`} padded>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            void command.run(() =>
              saveTitleExamPolicy(
                baseline,
                selected?.id ?? 0,
                selected?.version ?? 0,
                data,
                selected?.scriptText,
              ),
            );
          }}
        >
          <fieldset
            className={styles.form}
            disabled={command.busy || Boolean(command.success)}
          >
            <Message>
              {baseline.targetTitle} 시험 문장을 수정합니다.
              {!selected &&
                " 연결된 시험 문장이 없습니다. 시험 문장 연결을 확인해 주세요."}
            </Message>
            <Textarea
              name="scriptText"
              label="시험 문장 원문"
              value={scriptText}
              onChange={(event) => setScriptText(event.target.value)}
              maxLength={10000}
              required
              disabled={!selected}
              rows={6}
            />
            <Message>
              수정한 문장은 새로 생성하는 시험부터 적용됩니다. 기존 시험은 이전
              문장을 유지하며, 수정 문장의 TTS 음성은 저장 후 자동 생성됩니다.
              생성이 끝날 때까지 기준 음성 재생이 대기할 수 있습니다.
            </Message>
            <Field
              name="passingScore"
              label="합격 점수"
              type="number"
              min={1}
              max={100}
              step={1}
              defaultValue={baseline.passingScore}
              required
              hint="1~100점의 정수로 입력하세요."
            />
            <Reason />
            <Button
              primary
              type="submit"
              disabled={!selected || command.busy || Boolean(command.success)}
            >
              {command.busy ? "저장 중…" : "시험 설정 저장"}
            </Button>
          </fieldset>
          <CommandFeedback command={command} />
          <Button disabled={command.busy} onClick={onClose}>
            {command.success ? "닫기" : "취소"}
          </Button>
          {command.error && (
            <Message>
              입력값은 유지됩니다. 최신 설정을 확인하려면 취소 후 다시 설정
              변경을 열어 주세요.
            </Message>
          )}
        </form>
      </Panel>
    </div>
  );
}
