"use client";
import Link from "next/link";
import {
  Users,
  FileText,
  Mic,
  MessageSquare,
  Bell,
  PanelsTopLeft,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { useAdminQuery } from "../hooks";
import type { AdminPage, Inquiry, Audit } from "../types";
import {
  Heading,
  Panel,
  Badge,
  LoadState,
  ButtonLink,
  formatDate,
} from "./shared";
import styles from "../admin.module.css";
function Metric({
  title,
  path,
  href,
  icon: Icon,
}: {
  title: string;
  path: string;
  href: string;
  icon: typeof Users;
}) {
  const query = useAdminQuery<AdminPage<unknown>>(path, { size: 1, page: 0 });
  return (
    <Link href={href} className={styles.metric}>
      <div className={styles.metricTop}>
        <span>{title}</span>
        <Icon size={20} />
      </div>
      <strong>{query.data?.totalElements.toLocaleString() ?? "—"}</strong>
      <small>
        {query.isPending
          ? "불러오는 중"
          : query.isError
            ? "조회 실패 · 메뉴에서 다시 확인"
            : "현재 등록된 전체 항목"}
      </small>
    </Link>
  );
}
export function OverviewPage() {
  const inquiries = useAdminQuery<AdminPage<Inquiry>>("/inquiries", {
    status: "RECEIVED",
    size: 5,
  });
  const audits = useAdminQuery<AdminPage<Audit>>("/audit-logs", { size: 5 });
  return (
    <>
      <Heading
        title="운영 현황"
        description="회원과 콘텐츠, 전달할 안내를 한곳에서 관리하세요."
      >
        <ButtonLink href="/admin/contents/new" primary>
          <Plus size={15} />
          콘텐츠 등록
        </ButtonLink>
      </Heading>
      <div className={styles.cards}>
        <Metric
          title="전체 회원"
          path="/users"
          href="/admin/users"
          icon={Users}
        />
        <Metric
          title="학습 콘텐츠"
          path="/contents"
          href="/admin/contents"
          icon={FileText}
        />
        <Metric
          title="전체 문의"
          path="/inquiries"
          href="/admin/inquiries"
          icon={MessageSquare}
        />
        <Metric
          title="공지사항"
          path="/notices"
          href="/admin/notices"
          icon={Mic}
        />
        <Metric
          title="알림 초안·발송"
          path="/notification-campaigns"
          href="/admin/notifications"
          icon={Bell}
        />
        <Metric
          title="전체 팝업"
          path="/popups"
          href="/admin/popups"
          icon={PanelsTopLeft}
        />
      </div>
      <div className={styles.grid}>
        <Panel
          title="답변을 기다리는 문의"
          description="새로 접수된 문의를 확인해 주세요."
          action={
            <ButtonLink href="/admin/inquiries">
              전체 보기
              <ArrowUpRight size={13} />
            </ButtonLink>
          }
        >
          <LoadState
            loading={inquiries.isPending}
            error={inquiries.error}
            empty={inquiries.data?.items.length === 0}
            retry={() => void inquiries.refetch()}
          />
          {!!inquiries.data?.items.length && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>문의</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiries.data.items.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.wrap}>
                        <Link href={`/admin/inquiries/${item.id}`}>
                          {item.subject}
                        </Link>
                        <small>
                          회원 #{item.userId} · {formatDate(item.createdAt)}
                        </small>
                      </td>
                      <td>
                        <Badge value={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel
          title="최근 작업 이력"
          description="관리자 변경 기록을 확인하세요."
          action={
            <ButtonLink href="/admin/audit">
              전체 보기
              <ArrowUpRight size={13} />
            </ButtonLink>
          }
        >
          <LoadState
            loading={audits.isPending}
            error={audits.error}
            empty={audits.data?.items.length === 0}
            retry={() => void audits.refetch()}
          />
          {!!audits.data?.items.length && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>작업</th>
                    <th>처리</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.data.items.map((item) => (
                    <tr key={item.id}>
                      <td className={styles.wrap}>
                        {item.reason}
                        <small>
                          {item.action} · 관리자 #{item.actorId}
                        </small>
                        <small>{formatDate(item.createdAt)}</small>
                      </td>
                      <td>
                        <Badge value={item.outcome} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
