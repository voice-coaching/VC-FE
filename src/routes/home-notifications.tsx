"use client";

import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export type ProductNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
  read?: boolean;
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
}: {
  items: ReadonlyArray<ProductNotification>;
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
                className={`block px-5 py-3.5 ${item.read ? "bg-white" : "bg-[#f7f9ff]"}`}
              >
                {content}
              </Link>
            ) : (
              <article
                key={item.id}
                className={`px-5 py-3.5 ${item.read ? "bg-white" : "bg-[#f7f9ff]"}`}
              >
                {content}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export default function HomeNotifications() {
  // The backend currently exposes no notification contract. The exact list
  // renderer stays ready without presenting fabricated success data.
  const notifications: ProductNotification[] = [];

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
        <span className="ml-auto size-10" />
      </header>

      {notifications.length ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotificationList items={notifications} />
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
