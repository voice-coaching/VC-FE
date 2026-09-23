"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { getAuthenticatedUserId } from "@/lib/auth-session";
import { cacheResources } from "@/lib/cache-resources";
import {
  CLIENT_CACHE_SHORT_MAX_AGE_MS,
  readUserClientCache,
  writeUserClientCache,
} from "@/lib/client-cache";

export type ProductNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
  read?: boolean;
};

type NotificationCache = {
  items: ProductNotification[];
  unreadCount: number;
};

function dateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );
  if (dayDifference === 0) return "오늘";
  if (dayDifference === 1) return "어제";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationList({
  items,
  onRead,
}: {
  items: ReadonlyArray<ProductNotification>;
  onRead?: (id: string) => void;
}) {
  const groups = items.reduce<
    Array<{ key: string; label: string; items: ProductNotification[] }>
  >((result, item) => {
    const key = dateKey(item.createdAt);
    const current = result.at(-1);
    if (current?.key === key) {
      current.items.push(item);
    } else {
      result.push({ key, label: dateLabel(item.createdAt), items: [item] });
    }
    return result;
  }, []);

  return (
    <div className="pt-2">
      {groups.map((group, groupIndex) => (
        <section
          key={group.key}
          className={groupIndex ? "border-t border-[#f2f4f6]" : undefined}
        >
          <h2 className="px-5 pt-5 pb-1.5 text-[13px] leading-[18px] font-bold text-[#8b95a1]">
            {group.label}
          </h2>
          {group.items.map((item) => {
            const content = (
              <span className="flex flex-col gap-1.5">
                <span className="text-[13px] leading-[18px] font-medium text-[#6b7684]">
                  {item.title}
                </span>
                <span className="text-[15px] leading-[22px] font-medium text-[#191f28]">
                  {item.body}
                </span>
                <time className="text-xs leading-4 font-medium text-[#b0b8c1]">
                  {timeLabel(item.createdAt)}
                </time>
              </span>
            );

            return item.href ? (
              <Link
                href={item.href}
                key={item.id}
                onClick={() => onRead?.(item.id)}
                className={`block px-5 py-3.5 ${item.read ? "bg-white" : "bg-[#f7f9ff]"}`}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                key={item.id}
                onClick={() => onRead?.(item.id)}
                className={`block w-full px-5 py-3.5 text-left ${item.read ? "bg-white" : "bg-[#f7f9ff]"}`}
              >
                {content}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export default function HomeNotifications() {
  const userId = getAuthenticatedUserId();
  const [initialCache] = useState(() =>
    readUserClientCache<NotificationCache>(
      userId,
      cacheResources.notifications,
      CLIENT_CACHE_SHORT_MAX_AGE_MS,
    ),
  );
  const [notifications, setNotifications] = useState<ProductNotification[]>(
    initialCache?.items ?? [],
  );
  const [unreadCount, setUnreadCount] = useState(
    initialCache?.unreadCount ?? 0,
  );
  const [loading, setLoading] = useState(initialCache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const cached = readUserClientCache<NotificationCache>(
      userId,
      cacheResources.notifications,
      CLIENT_CACHE_SHORT_MAX_AGE_MS,
    );
    if (cached) {
      setNotifications(cached.items);
      setUnreadCount(cached.unreadCount);
      setLoading(false);
    }
    api.notifications
      .list({ page: 0, size: 50 })
      .then((data) => {
        if (!active) return;
        const items = data.items.map((item) => ({
          id: String(item.id),
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          href: item.deepLink?.startsWith("/") ? item.deepLink : undefined,
          read: item.readAt !== null,
        }));
        setNotifications(items);
        setUnreadCount(data.unreadCount);
        writeUserClientCache<NotificationCache>(
          userId,
          cacheResources.notifications,
          { items, unreadCount: data.unreadCount },
        );
      })
      .catch((reason: unknown) => {
        if (!active || cached) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "알림을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  function markRead(notificationId: string) {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.read) return;
    const nextItems = notifications.map((item) =>
      item.id === notificationId ? { ...item, read: true } : item,
    );
    const nextUnreadCount = Math.max(0, unreadCount - 1);
    setNotifications(nextItems);
    setUnreadCount(nextUnreadCount);
    writeUserClientCache<NotificationCache>(
      userId,
      cacheResources.notifications,
      { items: nextItems, unreadCount: nextUnreadCount },
    );
    void api.notifications.markRead(notificationId).catch(() => {
      setNotifications(notifications);
      setUnreadCount(unreadCount);
      writeUserClientCache<NotificationCache>(
        userId,
        cacheResources.notifications,
        { items: notifications, unreadCount },
      );
    });
  }

  async function markAllRead() {
    const previous = notifications;
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    const nextItems = previous.map((item) => ({ ...item, read: true }));
    writeUserClientCache<NotificationCache>(
      userId,
      cacheResources.notifications,
      { items: nextItems, unreadCount: 0 },
    );
    try {
      await api.notifications.markAllRead();
    } catch (reason) {
      setNotifications(previous);
      const previousUnreadCount = previous.filter((item) => !item.read).length;
      setUnreadCount(previousUnreadCount);
      writeUserClientCache<NotificationCache>(
        userId,
        cacheResources.notifications,
        { items: previous, unreadCount: previousUnreadCount },
      );
      setError(
        reason instanceof Error
          ? reason.message
          : "알림을 읽음 처리하지 못했습니다.",
      );
    }
  }

  return (
    <AppShell nav={false} className="flex min-h-0 flex-col bg-white">
      <header className="relative flex h-12 shrink-0 items-center px-2 py-1">
        <Link
          href="/home"
          aria-label="뒤로가기"
          className="flex size-10 items-center justify-center"
        >
          <Image
            src="/figma/home/chevron-left.svg"
            alt=""
            width={24}
            height={24}
          />
        </Link>
        <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] leading-6 font-bold text-[#191f28]">
          알림
        </h1>
        {unreadCount ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="ml-auto min-w-10 px-2 text-[13px] font-medium text-primary"
          >
            모두 읽음
          </button>
        ) : (
          <span className="ml-auto size-10" />
        )}
      </header>

      {loading ? (
        <section className="flex min-h-0 flex-1 items-center justify-center pb-[120px] text-sm text-[#8b95a1]">
          알림을 불러오는 중이에요
        </section>
      ) : error && !notifications.length ? (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 pb-[120px] text-center">
          <p className="text-sm text-[#8b95a1]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#f2f4f6] px-4 py-2 text-sm font-medium text-[#4e5968]"
          >
            다시 시도
          </button>
        </section>
      ) : notifications.length ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotificationList items={notifications} onRead={markRead} />
        </div>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center pb-[120px]">
          <Image
            src="/figma/home/inbox-empty.svg"
            alt=""
            width={48}
            height={48}
          />
          <p className="mt-5 text-base leading-[26px] font-medium text-[#b0b8c1]">
            받은 알림이 없어요
          </p>
        </section>
      )}
    </AppShell>
  );
}
