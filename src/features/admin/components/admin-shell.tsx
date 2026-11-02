"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getAccessToken } from "@/lib/api/client";
import { getAuthSessionSnapshot } from "@/lib/auth-session";
import { adminApi, adminErrorMessage, subscribeAdminDenial } from "../api";
import { useAdminSession } from "../hooks";
import {
  LayoutDashboard,
  Users,
  FileText,
  Mic,
  Bell,
  MessageSquare,
  PanelsTopLeft,
  ScrollText,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";
import { Button, ButtonLink } from "./shared";
import styles from "../admin.module.css";

export const adminNavigation = [
  { href: "/admin", title: "운영 현황", icon: LayoutDashboard },
  { href: "/admin/users", title: "회원 관리", icon: Users },
  { href: "/admin/contents", title: "학습 콘텐츠", icon: FileText },
  { href: "/admin/announcer", title: "아나운서 음성", icon: Mic },
  { href: "/admin/notices", title: "공지사항", icon: FileText },
  { href: "/admin/inquiries", title: "문의 관리", icon: MessageSquare },
  { href: "/admin/notifications", title: "알림 발송", icon: Bell },
  { href: "/admin/popups", title: "팝업 관리", icon: PanelsTopLeft },
  { href: "/admin/audit", title: "작업 이력", icon: ScrollText },
];
/** UI admission uses /admin/me, never the test membership flag. Every API also authorizes on the backend. */
export function AdminShell({ children }: { children: ReactNode }) {
  const session = useAdminSession();
  return (
    <ScopedAdminShell key={session} session={session}>
      {children}
    </ScopedAdminShell>
  );
}
function ScopedAdminShell({
  session,
  children,
}: {
  session: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [denial, setDenial] = useState<ApiError | null>(null);
  const anonymous =
    getAuthSessionSnapshot().status === "anonymous" && !getAccessToken();
  const access = useQuery({
    queryKey: ["admin", session, "access"],
    queryFn: ({ signal }) => adminApi.access(signal),
    enabled: !anonymous,
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  useEffect(() => subscribeAdminDenial(setDenial), []);
  const active = adminNavigation.find((item) =>
    item.href === "/admin"
      ? pathname === item.href
      : pathname.startsWith(item.href),
  );
  const error = anonymous
    ? new ApiError("로그인이 필요합니다.", 401)
    : (denial ?? access.error);
  if (error || !access.data)
    return (
      <main className={styles.gate}>
        <div className={styles.gateCard}>
          {error ? <LockKeyhole size={34} /> : <ShieldCheck size={34} />}
          <h1>
            {error ? "관리자 접근을 확인해 주세요" : "관리자 권한 확인 중"}
          </h1>
          <p>
            {error instanceof ApiError && [401, 403].includes(error.status)
              ? "이 계정에는 관리자 접근 권한이 없거나 로그인이 만료됐어요. 관리자 계정으로 다시 로그인해 주세요."
              : error
                ? adminErrorMessage(error)
                : "서버에서 현재 계정의 관리 권한을 확인하고 있습니다."}
          </p>
          <div className={`${styles.actions} justify-center`}>
            <ButtonLink href={`/auth?next=${encodeURIComponent(pathname)}`}>
              로그인
            </ButtonLink>
            {error && !anonymous && (
              <Button
                onClick={() => {
                  void access.refetch().then((result) => {
                    if (result.data && !result.error) setDenial(null);
                  });
                }}
              >
                권한 다시 확인
              </Button>
            )}
            <ButtonLink href="/home">서비스로 돌아가기</ButtonLink>
          </div>
        </div>
      </main>
    );
  return (
    <div className={styles.console}>
      <aside className={styles.sidebar}>
        <Link className={styles.logo} href="/admin">
          SpeakAI<span>관리자</span>
        </Link>
        <p className={styles.navLabel}>운영 관리</p>
        <nav className={styles.nav} aria-label="관리자 메뉴">
          {adminNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active?.href === item.href ? "page" : undefined}
            >
              <item.icon size={18} />
              {item.title}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/home">
            <ArrowUpRight size={15} />
            서비스 화면 보기
          </Link>
          SpeakAI 관리 화면
          <br />
          권한이 있는 운영자만 접근합니다.
        </div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            운영 관리
            <ChevronRight size={13} />
            <strong>{active?.title ?? "상세"}</strong>
          </div>
          <div className={styles.operator}>
            <span className={styles.avatar}>
              {access.data.nickname.slice(0, 1)}
            </span>
            <div>
              {access.data.nickname}
              <small>관리자</small>
            </div>
            <ShieldCheck size={17} color="#8794aa" />
          </div>
        </header>
        <main id="admin-main" className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}
