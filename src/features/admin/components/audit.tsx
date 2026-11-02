"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useAdminQuery } from "../hooks";
import { offsetTime } from "../services";
import type { AdminPage, Audit, Query } from "../types";
import {
  Heading,
  Panel,
  Button,
  Field,
  Select,
  LoadState,
  Pager,
  formatDate,
  Message,
} from "./shared";
import styles from "../admin.module.css";
export function AuditPage() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Query>({});
  const [error, setError] = useState<string | null>(null);
  const audits = useAdminQuery<AdminPage<Audit>>("/audit-logs", {
    ...filters,
    page,
    size: 20,
  });
  return (
    <>
      <Heading
        title="작업 이력"
        description="관리자 변경 작업의 사유와 처리 대상을 확인하세요."
      />
      <Panel>
        <form
          className={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              const next: Query = {
                actorId: String(data.get("actorId") ?? ""),
                action: String(data.get("action") ?? ""),
                targetType: String(data.get("targetType") ?? ""),
                targetId: String(data.get("targetId") ?? ""),
              };
              for (const key of ["from", "to"])
                if (data.get(key))
                  next[key] = offsetTime(String(data.get(key)));
              setFilters(next);
              setPage(0);
              setError(null);
            } catch (reason) {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "시각을 확인해 주세요.",
              );
            }
          }}
        >
          <Field label="관리자 번호" name="actorId" type="number" min={1} />
          <Select label="대상 유형" name="targetType">
            <option value="">전체</option>
            {[
              "CONTENT",
              "REFERENCE_AUDIO",
              "NOTICE",
              "INQUIRY",
              "NOTIFICATION_CAMPAIGN",
              "POPUP",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Field label="대상 번호" name="targetId" maxLength={100} />
          <Field label="작업 코드" name="action" maxLength={80} />
          <Field label="시작" name="from" type="datetime-local" />
          <Field label="종료" name="to" type="datetime-local" />
          <Button type="submit">
            <Search size={14} />
            조회
          </Button>
        </form>
        {error && <Message tone="error">{error}</Message>}
        <LoadState
          loading={audits.isPending}
          error={audits.error}
          empty={audits.data?.items.length === 0}
          retry={() => void audits.refetch()}
        />
        {audits.data && (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>작업</th>
                    <th>대상</th>
                    <th>사유</th>
                    <th>관리자</th>
                    <th>처리 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.data.items.map((audit) => (
                    <tr key={audit.id}>
                      <td>
                        {audit.action}
                        <small>변경: {audit.changedFields}</small>
                        <small className={styles.mono}>
                          추적 {audit.correlationId}
                        </small>
                      </td>
                      <td>
                        {audit.targetType}
                        <small>#{audit.targetId}</small>
                      </td>
                      <td className={styles.wrap}>{audit.reason}</td>
                      <td>#{audit.actorId}</td>
                      <td>{formatDate(audit.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={audits.data} onPage={setPage} />
          </>
        )}
      </Panel>
      <Message>
        성공한 변경 이력만 표시합니다. 조회·거절된 요청은 성공 기록에 포함되지
        않으며 기록 수정·삭제 기능은 제공하지 않습니다.
      </Message>
    </>
  );
}
