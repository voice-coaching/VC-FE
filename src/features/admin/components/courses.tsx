"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminCommand, useAdminQuery } from "../hooks";
import {
  readAdminCourse,
  saveAdminCourse,
  type AdminCourse,
  type AdminCourseSentence,
} from "../course-services";
import type { AdminPage } from "../types";
import {
  Heading,
  Panel,
  Button,
  ButtonLink,
  Badge,
  LoadState,
  Pager,
  Field,
  Textarea,
  Select,
  Reason,
  CommandFeedback,
  Message,
  label,
  formatDate,
} from "./shared";
import styles from "../admin.module.css";

/** Course IDs, not sentence names or the current content page, determine class membership. */
export function CoursesPanel() {
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState("");
  const courses = useAdminQuery<AdminPage<AdminCourse>>("/courses", {
    page,
    size: 20,
    keyword,
  });
  return (
    <Panel
      title="클래스"
      description="클래스 하나를 선택해 그 안의 문장과 설정을 함께 관리하세요."
      action={<ButtonLink href="/admin/courses/new">클래스 추가</ButtonLink>}
    >
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          setKeyword(
            String(new FormData(event.currentTarget).get("keyword") ?? ""),
          );
          setPage(0);
        }}
      >
        <Field name="keyword" label="클래스 제목 검색" maxLength={200} />
        <Button type="submit">클래스 조회</Button>
      </form>
      <LoadState
        loading={courses.isPending}
        error={courses.error}
        empty={courses.data?.items.length === 0}
        retry={() => void courses.refetch()}
      />
      {courses.data && (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>클래스</th>
                  <th>학습 초점</th>
                  <th>난이도</th>
                  <th>문장 수</th>
                  <th>공개 상태</th>
                  <th>마지막 수정</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {courses.data.items.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <Link href={`/admin/courses/${course.id}`}>
                        {course.title}
                      </Link>
                      <small>클래스 #{course.id}</small>
                    </td>
                    <td>{label(course.courseType)}</td>
                    <td>{label(course.difficulty)}</td>
                    <td>{course.sentences.length}문장</td>
                    <td>
                      <Badge value={course.status} />
                    </td>
                    <td>{formatDate(course.updatedAt)}</td>
                    <td>
                      <Link href={`/admin/courses/${course.id}`}>설정 →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={courses.data} onPage={setPage} />
        </>
      )}
    </Panel>
  );
}

export function CoursesPage() {
  return (
    <>
      <Heading
        title="클래스 콘텐츠"
        description="클래스 안에서 문장을 추가·수정·삭제할 수 있습니다."
      >
        <ButtonLink href="/admin/contents">전체 콘텐츠</ButtonLink>
      </Heading>
      <CoursesPanel />
    </>
  );
}

export function CourseDetail({ courseId }: { courseId?: number }) {
  const query = useAdminQuery<AdminCourse>(
    `/courses/${courseId}`,
    {},
    courseId !== undefined,
  );
  return (
    <>
      <Heading
        title={courseId ? "클래스 설정" : "새 클래스 등록"}
        description="클래스 정보와 모든 문장을 한 페이지에서 편집하세요."
      >
        {courseId && (
          <Button
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            최신 상태 조회
          </Button>
        )}
        <ButtonLink href="/admin/contents">목록</ButtonLink>
      </Heading>
      {courseId && (
        <LoadState
          loading={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
      )}
      {(courseId === undefined || query.data) && (
        <CourseEditor
          key={`${courseId ?? "new"}:${query.data?.version ?? 0}`}
          current={query.data ? readAdminCourse(query.data) : undefined}
        />
      )}
    </>
  );
}

type EditableSentence = AdminCourseSentence & { key: string };
function emptySentence(focus: AdminCourseSentence["focus"]): EditableSentence {
  return {
    key: crypto.randomUUID(),
    contentId: null,
    contentVersion: null,
    title: "",
    text: "",
    hint: "",
    focus,
    estimatedSeconds: 15,
  };
}
function CourseEditor({ current }: { current?: AdminCourse }) {
  const router = useRouter();
  const command = useAdminCommand(["/courses", "/contents", "/audit-logs"]);
  const [focus, setFocus] = useState<"PRONUNCIATION" | "INTONATION">(
    current?.courseType ?? "PRONUNCIATION",
  );
  const [sentences, setSentences] = useState<EditableSentence[]>(() =>
    current?.sentences.length
      ? current.sentences.map((sentence) => ({
          ...sentence,
          key: crypto.randomUUID(),
        }))
      : [emptySentence(focus)],
  );
  function change(key: string, update: Partial<AdminCourseSentence>) {
    setSentences((items) =>
      items.map((item) => (item.key === key ? { ...item, ...update } : item)),
    );
  }
  return (
    <Panel title={current?.title ?? "클래스 작성"} padded>
      <Message>
        문장 삭제는 아래 저장 버튼을 눌렀을 때 적용됩니다. 새 학습에는 수정한
        문장 구성을 적용하고, 기존 학습 기록의 원문은 보존합니다.
      </Message>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void command.run(
            () =>
              saveAdminCourse(
                data,
                sentences.map(({ key: _key, ...sentence }) => sentence),
                current,
              ),
            (saved) => router.push(`/admin/courses/${saved.id}`),
          );
        }}
      >
        <Field
          name="title"
          label="클래스 제목"
          defaultValue={current?.title ?? ""}
          maxLength={255}
          required
        />
        <Textarea
          name="description"
          label="클래스 소개"
          defaultValue={current?.description ?? ""}
          maxLength={1000}
          rows={3}
        />
        <div className={styles.formGrid}>
          <Select
            name="courseType"
            label="클래스 유형"
            value={focus}
            onChange={(event) => setFocus(event.target.value as typeof focus)}
          >
            {["PRONUNCIATION", "INTONATION"].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Select>
          <Select
            name="difficulty"
            label="난이도"
            defaultValue={current?.difficulty ?? "BEGINNER"}
          >
            {["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Select>
          <Select
            name="status"
            label="공개 상태"
            defaultValue={current?.status ?? "DRAFT"}
          >
            {["DRAFT", "PUBLISHED", "HIDDEN"].map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </Select>
          <Field
            name="estimatedMinutes"
            label="예상 학습 시간(분)"
            type="number"
            min={1}
            max={3600}
            defaultValue={current?.estimatedMinutes ?? 5}
            required
          />
        </div>
        <h2>클래스 문장 {sentences.length}개</h2>
        {sentences.map((sentence, index) => (
          <fieldset
            key={sentence.key}
            className={`${styles.form} ${styles.sentenceEditor}`}
            disabled={command.busy}
          >
            <legend>{index + 1}번 문장</legend>
            <Field
              label={`${index + 1}번 문장 제목`}
              value={sentence.title}
              onChange={(event) =>
                change(sentence.key, { title: event.target.value })
              }
              maxLength={255}
              required
            />
            <Textarea
              label={`${index + 1}번 연습 문장`}
              value={sentence.text}
              onChange={(event) =>
                change(sentence.key, { text: event.target.value })
              }
              maxLength={10000}
              rows={3}
              required
            />
            <Textarea
              label={`${index + 1}번 문장 안내`}
              value={sentence.hint ?? ""}
              onChange={(event) =>
                change(sentence.key, { hint: event.target.value })
              }
              maxLength={500}
              rows={2}
            />
            <div className={styles.formGrid}>
              <Select
                label={`${index + 1}번 학습 초점`}
                value={sentence.focus}
                onChange={(event) =>
                  change(sentence.key, {
                    focus: event.target.value as AdminCourseSentence["focus"],
                  })
                }
              >
                {["PRONUNCIATION", "INTONATION", "BOTH"].map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </Select>
              <Field
                label={`${index + 1}번 예상 연습 시간(초)`}
                type="number"
                min={1}
                max={3600}
                value={sentence.estimatedSeconds}
                onChange={(event) =>
                  change(sentence.key, {
                    estimatedSeconds: Number(event.target.value),
                  })
                }
                required
              />
            </div>
            <Button
              danger
              disabled={sentences.length === 1 || command.busy}
              onClick={() =>
                setSentences((items) =>
                  items.filter((item) => item.key !== sentence.key),
                )
              }
            >
              {index + 1}번 문장 삭제
            </Button>
          </fieldset>
        ))}
        <Button
          disabled={command.busy || sentences.length >= 10}
          onClick={() =>
            setSentences((items) => [...items, emptySentence(focus)])
          }
        >
          문장 추가
        </Button>
        <Reason />
        <CommandFeedback command={command} />
        <div className={styles.formFooter}>
          <Button type="submit" primary disabled={command.busy}>
            {command.busy
              ? "저장 중…"
              : current
                ? "클래스 변경사항 저장"
                : "클래스 등록"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
