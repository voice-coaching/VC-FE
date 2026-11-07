"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminCommand, useAdminQuery } from "../hooks";
import {
  policyListSchema,
  saveTitleExamPolicy,
  type TitleExamPolicy,
} from "../title-exam-policies";
import type { AdminPage, Content } from "../types";
import {
  Heading,
  Panel,
  Button,
  ButtonLink,
  Field,
  LoadState,
  Message,
  Pager,
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
      >
        <ButtonLink href="/admin/contents/new">시험 문장 등록</ButtonLink>
      </Heading>
      <Message>
        새 문장은 학습 콘텐츠에서 유형 ‘문장’, 분류 ‘승급 심사’로 등록하고
        공개한 뒤 선택하세요. 변경한 설정은 새로 생성하는 시험부터 적용됩니다.
        응시 횟수 정책은 변경하지 않습니다.
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
        description="시험 문장을 선택하고 합격 점수를 설정하세요."
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
  const [selected, setSelected] = useState<Pick<
    Content,
    "id" | "version" | "title" | "scriptText"
  > | null>(baseline.available ? baseline.content : null);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(0);
  const candidates = useAdminQuery<AdminPage<Content>>("/contents", {
    type: "SENTENCE",
    category: "TITLE_EXAM",
    status: "PUBLISHED",
    keyword,
    page,
    size: 10,
  });
  const command = useAdminCommand(["/title-exam-policies", "/audit-logs"]);
  return (
    <div
      ref={editor}
      role="region"
      aria-label={`${baseline.targetTitle} 시험 설정 변경`}
      tabIndex={-1}
    >
      <Panel title={`${baseline.targetTitle} 시험 설정 변경`} padded>
        <form
          className={styles.filters}
          onSubmit={(e) => {
            e.preventDefault();
            setKeyword(
              String(new FormData(e.currentTarget).get("keyword") ?? "").trim(),
            );
            setPage(0);
          }}
        >
          <Field
            label="시험 문장 검색"
            name="keyword"
            maxLength={200}
            placeholder="문제 제목"
            disabled={command.busy || Boolean(command.success)}
          />
          <Button type="submit" disabled={command.busy}>
            검색
          </Button>
        </form>
        <LoadState
          loading={candidates.isPending}
          error={candidates.error}
          retry={() => void candidates.refetch()}
          empty={candidates.data?.items.length === 0}
        />
        {candidates.data && !candidates.error && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>시험 문장</th>
                    <th>선택</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.title}
                        <p className="whitespace-pre-wrap">{item.scriptText}</p>
                      </td>
                      <td>
                        <Button
                          disabled={command.busy}
                          onClick={() => setSelected(item)}
                        >
                          {selected?.id === item.id ? "선택됨" : "이 문장 선택"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              data={candidates.data}
              onPage={(page) => {
                if (!command.busy) setPage(page);
              }}
            />
          </>
        )}
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
              ),
            );
          }}
        >
          <fieldset
            className={styles.form}
            disabled={command.busy || Boolean(command.success)}
          >
            <Message>
              선택한 문제: {selected?.title ?? "문장을 선택해 주세요."}
            </Message>
            {selected && (
              <p className="whitespace-pre-wrap">{selected.scriptText}</p>
            )}
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
