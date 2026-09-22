"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TopBar } from "@/components/top-bar";

export type ProductNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
  read?: boolean;
};

export function NotificationList({
  items,
}: {
  items: ReadonlyArray<ProductNotification>;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const content = (
          <>
            <span
              aria-hidden="true"
              className="mt-1 size-2 shrink-0 rounded-full bg-primary"
              style={{ opacity: item.read ? 0 : 1 }}
            />
            <span className="min-w-0 flex-1">
              <strong className="block text-[15px] leading-6">
                {item.title}
              </strong>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                {item.body}
              </span>
              <time className="mt-2 block text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </time>
            </span>
            {item.href ? (
              <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
            ) : null}
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className="design-card flex gap-3 !p-4">
                {content}
              </Link>
            ) : (
              <article className="design-card flex gap-3 !p-4">
                {content}
              </article>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function HomeNotifications() {
  // The backend currently exposes no notification contract. Keep the renderer
  // ready, but do not invent successful notification data.
  const notifications: ProductNotification[] = [];

  return (
    <AppShell nav={false}>
      <TopBar to="/home" title="알림" />
      <div className="flex min-h-[calc(100dvh-64px)] flex-col px-5 pb-8">
        {notifications.length ? (
          <NotificationList items={notifications} />
        ) : (
          <section className="my-auto py-16 text-center" aria-live="polite">
            <span className="mx-auto flex size-20 items-center justify-center rounded-[28px] bg-[#eaf4ff] text-primary">
              <Bell className="size-9" strokeWidth={1.8} />
            </span>
            <h1 className="mt-6 text-xl font-bold">새로운 알림이 없어요</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              알림 데이터 연동은 준비 중이에요.
              <br />새 소식이 생기면 이곳에서 확인할 수 있어요.
            </p>
            <Link
              href="/home"
              className="mx-auto mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-7 text-sm font-bold text-white"
            >
              홈으로 돌아가기
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
