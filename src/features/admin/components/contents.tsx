"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useAdminQuery, useAdminCommand, useAdminSession } from "../hooks";
import { saveContent, publication, deleteContent } from "../services";
import type {
  AdminPage,
  Content,
  ContentType,
  Category,
  Query,
} from "../types";
import { AudioPanel } from "./reference-audio";
import {
  Heading,
  Panel,
  Badge,
  Button,
  ButtonLink,
  LoadState,
  Pager,
  Field,
  Textarea,
  Select,
  Reason,
  CommandFeedback,
  ConfirmAction,
  DetailList,
  Message,
  formatDate,
  label,
} from "./shared";
import styles from "../admin.module.css";
import { CoursesPanel } from "./courses";
export function ContentsPage({ announcer = false }: { announcer?: boolean }) {
  const router = useRouter();
  const base = announcer ? "/admin/announcer" : "/admin/contents";
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Query>({});
  const contents = useAdminQuery<AdminPage<Content>>("/contents", {
    ...filters,
    ...(announcer ? { type: "ANNOUNCER" } : {}),
    ...(!announcer ? { excludeClassPractice: true } : {}),
    page,
    size: 20,
  });
  return (
    <>
      <Heading
        title={announcer ? "아나운서 음성" : "학습 콘텐츠"}
        description={
          announcer
            ? "연습 문장을 등록하고 아나운서 기준 음성을 연결하세요."
            : "클래스는 묶음으로, 일반 콘텐츠는 문장별로 관리하세요."
        }
      >
        <ButtonLink href={`${base}/new`} primary>
          <Plus size={16} />
          {announcer ? "문장·음성 등록" : "새 콘텐츠"}
        </ButtonLink>
      </Heading>
      {!announcer && <CoursesPanel />}
      <Panel>
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (data.get("type") === "CLASS_PRACTICE") {
              router.push("/admin/courses");
              return;
            }
            setFilters({
              keyword: String(data.get("keyword") ?? ""),
              type: String(data.get("type") ?? ""),
              status: String(data.get("status") ?? ""),
            });
            setPage(0);
          }}
        >
          <Field
            name="keyword"
            label="제목 검색"
            placeholder="콘텐츠 제목"
            maxLength={200}
          />
          {!announcer && (
            <Select name="type" label="콘텐츠 유형">
              <option value="">전체 유형</option>
              {["SENTENCE", "ANNOUNCER", "NEWS", "CLASS_PRACTICE"].map(
                (value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ),
              )}
            </Select>
          )}
          <Select name="status" label="공개 상태">
            <option value="">전체 상태</option>
            {["DRAFT", "PUBLISHED", "HIDDEN"].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Select>
          <Button type="submit">
            <Search size={14} />
            조회
          </Button>
        </form>
        <LoadState
          loading={contents.isPending}
          error={contents.error}
          empty={contents.data?.items.length === 0}
          retry={() => void contents.refetch()}
        />
        {contents.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>콘텐츠</th>
                    <th>유형</th>
                    <th>난이도</th>
                    <th>공개 상태</th>
                    <th>마지막 수정</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {contents.data.items.map((content) => (
                    <tr key={content.id}>
                      <td className={styles.wrap}>
                        <Link href={`${base}/${content.id}`}>
                          {content.title}
                        </Link>
                        <small>
                          #{content.id} ·{" "}
                          {content.category
                            ? label(content.category)
                            : "분류 없음"}
                        </small>
                      </td>
                      <td>{label(content.type)}</td>
                      <td>{label(content.difficulty)}</td>
                      <td>
                        <Badge value={content.status} />
                      </td>
                      <td>{formatDate(content.updatedAt)}</td>
                      <td>
                        <Link href={`${base}/${content.id}`}>관리 →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={contents.data} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
export function ContentDetail({
  contentId,
  announcer = false,
}: {
  contentId?: number;
  announcer?: boolean;
}) {
  const content = useAdminQuery<Content>(
    `/contents/${contentId}`,
    {},
    contentId !== undefined,
  );
  const [cloning, setCloning] = useState(false);
  const current = content.data;
  const router = useRouter();
  const queries = useQueryClient();
  const session = useAdminSession();
  const listHref = announcer ? "/admin/announcer" : "/admin/contents";
  return (
    <>
      <Heading
        title={contentId ? "콘텐츠 상세" : "새 콘텐츠 등록"}
        description="문장 내용을 검수한 뒤 공개해 주세요."
      >
        {contentId && (
          <Button
            disabled={content.isFetching}
            onClick={() => void content.refetch()}
          >
            최신 상태 조회
          </Button>
        )}
        <ButtonLink href={announcer ? "/admin/announcer" : "/admin/contents"}>
          목록
        </ButtonLink>
      </Heading>
      {contentId && (
        <LoadState
          loading={content.isPending}
          error={content.error}
          retry={() => void content.refetch()}
        />
      )}{" "}
      {(contentId === undefined || current) && (
        <>
          {current && (
            <Panel
              title={current.title}
              action={<Badge value={current.status} />}
              padded
            >
              <DetailList
                items={[
                  ["콘텐츠 번호", `#${current.id}`],
                  ["콘텐츠 유형", label(current.type)],
                  ["수정 번호", current.version],
                  ["최초 공개", formatDate(current.publishedAt)],
                ]}
              />
              <div className={`${styles.actions} mt-6`}>
                {current.status !== "PUBLISHED" && (
                  <ConfirmAction
                    invalidationPaths={["/contents", "/audit-logs"]}
                    title="콘텐츠를 공개할까요?"
                    description="문장과 기준 음성을 검수한 뒤 공개해 주세요."
                    buttonLabel="공개하기"
                    primary
                    action={(reason) =>
                      publication(current, "PUBLISHED", reason)
                    }
                  />
                )}{" "}
                {current.status === "PUBLISHED" && (
                  <ConfirmAction
                    invalidationPaths={["/contents", "/audit-logs"]}
                    title="콘텐츠를 숨길까요?"
                    description="공용 목록에서 숨기며 기존 학습 기록은 보존됩니다."
                    buttonLabel="숨기기"
                    danger
                    action={(reason) => publication(current, "HIDDEN", reason)}
                  />
                )}{" "}
                {current && (
                  <Button onClick={() => setCloning(true)}>
                    내용을 복사해 새 초안 작성
                  </Button>
                )}
                <ConfirmAction
                  invalidationPaths={["/contents", "/audit-logs"]}
                  title="콘텐츠를 삭제할까요?"
                  description="새 학습 목록과 연습에서 제외됩니다. 기존 학습 기록은 보존되며 이 화면에서 복구할 수 없습니다. 저장하지 않은 편집 내용은 적용되지 않습니다."
                  buttonLabel="삭제하기"
                  danger
                  action={(reason) => deleteContent(current, reason)}
                  onDone={() => {
                    const path = `/contents/${current.id}`;
                    queries.removeQueries({
                      predicate: (query) =>
                        query.queryKey[0] === "admin" &&
                        query.queryKey[1] === session &&
                        typeof query.queryKey[2] === "string" &&
                        (query.queryKey[2] === path ||
                          query.queryKey[2].startsWith(`${path}/`)),
                    });
                    router.replace(listHref);
                  }}
                />
              </div>
            </Panel>
          )}
          <ContentEditor
            key={`${current?.id ?? "new"}-${current?.version ?? 0}-${cloning}`}
            current={cloning ? undefined : current}
            initial={current}
            announcer={announcer}
          />{" "}
          {current?.type === "ANNOUNCER" && !cloning && (
            <AudioPanel
              key={`${current.id}:${current.version}`}
              content={current}
            />
          )}
        </>
      )}
    </>
  );
}
function ContentEditor({
  current,
  initial,
  announcer,
}: {
  current?: Content;
  initial?: Content;
  announcer: boolean;
}) {
  const router = useRouter();
  const command = useAdminCommand(["/contents", "/audit-logs"]);
  const [type, setType] = useState<ContentType>(
    current?.type ?? initial?.type ?? (announcer ? "ANNOUNCER" : "SENTENCE"),
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const categories = useAdminQuery<Category[]>("/content-categories", { type });
  return (
    <Panel
      title={current ? "콘텐츠 편집" : "콘텐츠 작성"}
      description="공용 콘텐츠로 저장됩니다. 등록 이후 음성을 연결하고 공개할 수 있습니다."
      padded
    >
      {current?.type === "ANNOUNCER" && (
        <Message>
          원문을 수정하면 기존 기준 음성이 제외됩니다. 저장한 문장에 맞는 음성을
          다시 등록해 주세요. 제목만 수정하면 음성은 유지됩니다.
        </Message>
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          if (current || announcer) data.set("type", type);
          void command.run(
            () => saveContent(data, current),
            (saved) =>
              router.push(
                `${saved.type === "ANNOUNCER" ? "/admin/announcer" : "/admin/contents"}/${saved.id}`,
              ),
          );
        }}
      >
        <div className={styles.formGrid}>
          <Select
            label="콘텐츠 유형"
            name="type"
            value={type}
            disabled={!!current || announcer}
            onChange={(event) => {
              if (!current && event.target.value === "CLASS_PRACTICE") {
                router.push("/admin/courses/new");
                return;
              }
              setType(event.target.value as ContentType);
              setCategory("");
            }}
          >
            {["SENTENCE", "ANNOUNCER", "NEWS", "CLASS_PRACTICE"].map(
              (value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ),
            )}
          </Select>
          <Select
            key={type}
            name="category"
            label="카테고리"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            required
            disabled={categories.isPending || categories.isError}
          >
            <option value="">카테고리를 선택해 주세요.</option>
            {categories.data?.map((category) => (
              <option key={category.code} value={category.code}>
                {category.label}
              </option>
            ))}
          </Select>
          <Select
            name="focus"
            label="학습 초점"
            defaultValue={initial?.focus ?? "PRONUNCIATION"}
          >
            {["PRONUNCIATION", "INTONATION", "BOTH"].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Select>
          <Select
            name="difficulty"
            label="난이도"
            defaultValue={initial?.difficulty ?? "BEGINNER"}
          >
            {["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Select>
        </div>
        {categories.isError && (
          <Message tone="error">
            카테고리를 불러오지 못했습니다.{" "}
            <Button onClick={() => void categories.refetch()}>다시 조회</Button>
          </Message>
        )}
        <Field
          name="title"
          label="콘텐츠 제목"
          defaultValue={initial?.title ?? ""}
          required
          maxLength={255}
          placeholder="아나운서 따라 읽기"
        />
        <Textarea
          name="description"
          label="짧은 소개"
          maxLength={1000}
          defaultValue={initial?.description ?? ""}
          rows={2}
        />
        <Textarea
          name="scriptText"
          label="연습할 문장·원문"
          defaultValue={initial?.scriptText ?? ""}
          required
          maxLength={10000}
          rows={6}
          placeholder="학습자가 듣고 따라 읽을 문장을 입력하세요."
          hint="실제 AI 분석의 글자 수·녹음 길이 제한은 별도로 적용됩니다."
        />
        <div className={styles.formGrid}>
          <Textarea
            name="targets"
            label="집중 발음 목표"
            defaultValue={initial?.targetPronunciations?.join("\n") ?? ""}
            hint="한 줄에 하나씩 입력해 주세요. 비워 둘 수 있습니다."
            rows={2}
          />
          <Field
            name="seconds"
            label="예상 연습 시간(초)"
            type="number"
            min={1}
            max={3600}
            defaultValue={initial?.estimatedSeconds ?? 15}
            required
          />
        </div>
        <Reason />
        <CommandFeedback command={command} />
        <div className={styles.formFooter}>
          <Button
            type="submit"
            primary
            disabled={command.busy || !categories.data?.length}
          >
            {command.busy
              ? "저장 중…"
              : current
                ? "변경사항 저장"
                : "초안 등록"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
