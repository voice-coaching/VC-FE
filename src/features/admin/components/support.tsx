"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { useAdminQuery, useAdminCommand } from "../hooks";
import {
  saveNotice,
  localDateTime,
  answerInquiry,
  transitionInquiry,
} from "../services";
import type { AdminPage, Notice, Inquiry, Query } from "../types";
import {
  Heading,
  Panel,
  Badge,
  Button,
  ButtonLink,
  Field,
  Textarea,
  Select,
  Check,
  Reason,
  LoadState,
  Pager,
  CommandFeedback,
  ConfirmAction,
  DetailList,
  formatDate,
  label,
} from "./shared";
import styles from "../admin.module.css";
export function NoticesPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Query>({});
  const notices = useAdminQuery<AdminPage<Notice>>("/notices", {
    ...filters,
    page,
    size: 20,
  });
  return (
    <>
      <Heading
        title="공지사항"
        description="서비스 공지의 공개·예약·상단 고정을 관리하세요."
      >
        <ButtonLink href="/admin/notices/new" primary>
          <Plus size={15} />새 공지
        </ButtonLink>
      </Heading>
      <Panel>
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setFilters({
              keyword: String(data.get("keyword") ?? ""),
              published: String(data.get("published") ?? ""),
            });
            setPage(0);
          }}
        >
          <Field label="제목 검색" name="keyword" maxLength={200} />
          <Select name="published" label="공개 설정">
            <option value="">전체</option>
            <option value="true">공개·예약</option>
            <option value="false">비공개</option>
          </Select>
          <Button type="submit">
            <Search size={14} />
            조회
          </Button>
        </form>
        <LoadState
          loading={notices.isPending}
          error={notices.error}
          empty={notices.data?.items.length === 0}
          retry={() => void notices.refetch()}
        />
        {notices.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>공지</th>
                    <th>공개 설정</th>
                    <th>상단 고정</th>
                    <th>게시 시각</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {notices.data.items.map((notice) => (
                    <tr key={notice.id}>
                      <td className={styles.wrap}>
                        <Link href={`/admin/notices/${notice.id}`}>
                          {notice.title}
                        </Link>
                        <small>{notice.summary}</small>
                      </td>
                      <td>
                        <Badge
                          value={notice.published ? "공개·예약" : "비공개"}
                        />
                      </td>
                      <td>{notice.pinned ? "고정" : "—"}</td>
                      <td>{formatDate(notice.publishedAt)}</td>
                      <td>
                        <Link href={`/admin/notices/${notice.id}`}>편집 →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={notices.data} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
export function NoticeDetail({ noticeId }: { noticeId?: number }) {
  const notice = useAdminQuery<Notice>(
    `/notices/${noticeId}`,
    {},
    noticeId !== undefined,
  );
  return (
    <>
      <Heading
        title={noticeId ? "공지 편집" : "새 공지 작성"}
        description="본문을 구역과 문단으로 나누어 작성하세요."
      >
        <ButtonLink href="/admin/notices">공지 목록</ButtonLink>
      </Heading>
      {noticeId && (
        <LoadState
          loading={notice.isPending}
          error={notice.error}
          retry={() => void notice.refetch()}
        />
      )}{" "}
      {(noticeId === undefined || notice.data) && (
        <NoticeEditor
          key={`${notice.data?.id ?? "new"}-${notice.data?.version ?? 0}`}
          current={notice.data}
        />
      )}
    </>
  );
}
function NoticeEditor({ current }: { current?: Notice }) {
  const router = useRouter();
  const command = useAdminCommand(["/notices", "/audit-logs"]);
  const [sections, setSections] = useState(
    current?.sections.map((section) => ({
      title: section.title,
      paragraphsText: section.paragraphs.join("\n"),
    })) ?? [{ title: "안내", paragraphsText: "" }],
  );
  return (
    <Panel title="공지 내용" padded>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("sections", JSON.stringify(sections));
          void command.run(
            () => saveNotice(data, current),
            (saved) => router.push(`/admin/notices/${saved.id}`),
          );
        }}
      >
        <Field
          name="title"
          label="제목"
          defaultValue={current?.title ?? ""}
          maxLength={200}
          required
        />
        <Textarea
          name="summary"
          label="짧은 요약"
          defaultValue={current?.summary ?? ""}
          maxLength={500}
          rows={2}
          required
        />
        {sections.map((section, index) => (
          <div className={styles.sectionEditor} key={index}>
            <div className={styles.sectionHeader}>
              본문 구역 {index + 1}
              <button
                type="button"
                aria-label={`구역 ${index + 1} 삭제`}
                disabled={sections.length === 1}
                onClick={() =>
                  setSections((items) => items.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
            <Field
              label="구역 제목"
              required
              maxLength={200}
              value={section.title}
              onChange={(event) =>
                setSections((items) =>
                  items.map((item, i) =>
                    i === index ? { ...item, title: event.target.value } : item,
                  ),
                )
              }
            />
            <Textarea
              label="본문"
              required
              value={section.paragraphsText}
              rows={5}
              hint="줄바꿈으로 문단을 나눕니다. HTML은 사용하지 않습니다."
              onChange={(event) =>
                setSections((items) =>
                  items.map((item, i) =>
                    i === index
                      ? { ...item, paragraphsText: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </div>
        ))}
        <div>
          <Button
            disabled={sections.length >= 30}
            onClick={() =>
              setSections((items) => [
                ...items,
                { title: "", paragraphsText: "" },
              ])
            }
          >
            <Plus size={14} />
            본문 구역 추가
          </Button>
        </div>
        <Field
          name="publishedAt"
          type="datetime-local"
          label="게시 시각"
          defaultValue={localDateTime(current?.publishedAt)}
          required
        />
        <div className={styles.actions}>
          <Check
            name="published"
            label="공개·예약 게시"
            defaultChecked={current?.published ?? false}
          />
          <Check
            name="pinned"
            label="상단에 고정"
            defaultChecked={current?.pinned ?? false}
          />
        </div>
        <Reason />
        <CommandFeedback command={command} />
        <div className={styles.formFooter}>
          <Button primary type="submit" disabled={command.busy}>
            {command.busy ? "저장 중…" : "공지 저장"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
export function InquiriesPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Query>({});
  const inquiries = useAdminQuery<AdminPage<Inquiry>>("/inquiries", {
    ...filters,
    page,
    size: 20,
  });
  return (
    <>
      <Heading
        title="문의 관리"
        description="회원 문의에 답변하고 처리 상태를 관리하세요."
      />
      <Panel>
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setFilters({
              keyword: String(data.get("keyword") ?? ""),
              status: String(data.get("status") ?? ""),
            });
            setPage(0);
          }}
        >
          <Field name="keyword" label="문의 제목" maxLength={200} />
          <Select label="처리 상태" name="status">
            <option value="">전체 상태</option>
            {["RECEIVED", "IN_PROGRESS", "ANSWERED", "CLOSED"].map((value) => (
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
          loading={inquiries.isPending}
          error={inquiries.error}
          empty={inquiries.data?.items.length === 0}
          retry={() => void inquiries.refetch()}
        />
        {inquiries.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>문의</th>
                    <th>회원</th>
                    <th>분류</th>
                    <th>상태</th>
                    <th>접수일</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {inquiries.data.items.map((inquiry) => (
                    <tr key={inquiry.id}>
                      <td className={styles.wrap}>
                        <Link href={`/admin/inquiries/${inquiry.id}`}>
                          {inquiry.subject}
                        </Link>
                      </td>
                      <td>
                        <Link href={`/admin/users/${inquiry.userId}`}>
                          #{inquiry.userId}
                        </Link>
                      </td>
                      <td>{label(inquiry.category)}</td>
                      <td>
                        <Badge value={inquiry.status} />
                      </td>
                      <td>{formatDate(inquiry.createdAt)}</td>
                      <td>
                        <Link href={`/admin/inquiries/${inquiry.id}`}>
                          답변 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={inquiries.data} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
export function InquiryDetail({ inquiryId }: { inquiryId: number }) {
  const inquiry = useAdminQuery<Inquiry>(`/inquiries/${inquiryId}`);
  const command = useAdminCommand(["/inquiries", "/audit-logs"]);
  const current = inquiry.data;
  return (
    <>
      <Heading
        title={current?.subject ?? "문의 상세"}
        description="문의 본문과 관련 기록을 확인한 뒤 답변하세요."
      >
        <ButtonLink href="/admin/inquiries">문의 목록</ButtonLink>
      </Heading>
      <LoadState
        loading={inquiry.isPending}
        error={inquiry.error}
        retry={() => void inquiry.refetch()}
      />
      {current && (
        <>
          <Panel
            title="접수 내용"
            action={<Badge value={current.status} />}
            padded
          >
            <DetailList
              items={[
                [
                  "작성 회원",
                  <Link key="user" href={`/admin/users/${current.userId}`}>
                    회원 #{current.userId}
                  </Link>,
                ],
                ["문의 분류", current.category],
                ["접수 시각", formatDate(current.createdAt)],
                ["관련 학습 기록", current.relatedSessionId ?? "—"],
              ]}
            />
            <hr className="my-6 border-slate-100" />
            <p className={styles.prose}>{current.body}</p>
          </Panel>
          <Panel title="문의 답변" padded>
            <form
              key={current.version}
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                void command.run(() =>
                  answerInquiry(
                    current.id,
                    current.version,
                    String(data.get("answer") ?? ""),
                    String(data.get("reason") ?? ""),
                  ),
                );
              }}
            >
              <Textarea
                name="answer"
                label="답변 내용"
                defaultValue={current.answer ?? ""}
                required
                maxLength={4000}
                rows={6}
                disabled={current.status === "CLOSED"}
              />
              {current.status !== "CLOSED" && (
                <>
                  <Reason />
                  <CommandFeedback command={command} />
                  <div className={styles.formFooter}>
                    <Button type="submit" primary disabled={command.busy}>
                      답변 저장
                    </Button>
                  </div>
                </>
              )}
            </form>
            <div className="mt-5">
              {current.status === "RECEIVED" && (
                <ConfirmAction
                  invalidationPaths={["/inquiries", "/audit-logs"]}
                  title="문의를 처리 중으로 변경할까요?"
                  description="문의의 담당 처리를 시작합니다."
                  buttonLabel="처리 시작"
                  action={(reason) =>
                    transitionInquiry(
                      current.id,
                      current.version,
                      "IN_PROGRESS",
                      reason,
                    )
                  }
                />
              )}{" "}
              {current.status === "ANSWERED" && (
                <ConfirmAction
                  invalidationPaths={["/inquiries", "/audit-logs"]}
                  title="이 문의를 종료할까요?"
                  description="종료한 문의는 다시 열거나 답변을 수정할 수 없습니다."
                  buttonLabel="문의 종료"
                  danger
                  action={(reason) =>
                    transitionInquiry(
                      current.id,
                      current.version,
                      "CLOSED",
                      reason,
                    )
                  }
                />
              )}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
