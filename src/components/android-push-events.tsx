"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { App } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import {
  FirebaseMessaging,
  isAndroidApp,
  reconcileAndroidPushSession,
  refreshAndroidPush,
} from "@/lib/android-push";
import { subscribeAuthSession } from "@/lib/api/client";
import { requestNavigation } from "@/lib/navigation";

export function AndroidPushEvents() {
  const router = useRouter();
  const [message, setMessage] = useState<{
    title: string;
    body: string;
  } | null>(null);
  useEffect(() => {
    if (!isAndroidApp()) return;
    let disposed = false;
    let sessionTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeAuthSession(() => {
      clearTimeout(sessionTimer);
      sessionTimer = setTimeout(() => {
        void reconcileAndroidPushSession().catch(() => undefined);
      }, 0);
    });
    const handles: PluginListenerHandle[] = [];
    const add = async (pending: Promise<PluginListenerHandle>) => {
      const handle = await pending;
      if (disposed) await handle.remove();
      else handles.push(handle);
    };
    void add(
      FirebaseMessaging.addListener("tokenReceived", () => {
        void refreshAndroidPush().catch(() => undefined);
      }),
    ).catch(() => undefined);
    void add(
      FirebaseMessaging.addListener(
        "notificationReceived",
        ({ notification }) => {
          setMessage({
            title: notification.title ?? "새 알림",
            body: notification.body ?? "알림함을 확인해 주세요.",
          });
        },
      ),
    ).catch(() => undefined);
    void add(
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void refreshAndroidPush().catch(() => undefined);
      }),
    ).catch(() => undefined);
    void add(
      FirebaseMessaging.addListener(
        "notificationActionPerformed",
        ({ notification }) => {
          const data = notification.data;
          const path =
            data && typeof data === "object" && "deepLink" in data
              ? data.deepLink
              : null;
          requestNavigation(() =>
            router.push(
              path === "/home" || path === "/mypage"
                ? path
                : "/home/notifications",
            ),
          );
        },
      ),
    ).catch(() => undefined);
    void refreshAndroidPush().catch(() => undefined);
    return () => {
      disposed = true;
      clearTimeout(sessionTimer);
      unsubscribe();
      handles.forEach((handle) => void handle.remove());
    };
  }, [router]);
  return message ? (
    <div
      role="status"
      className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-[370px] -translate-x-1/2 rounded-2xl bg-[#191f28] p-4 text-white shadow-lg"
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={() => {
          setMessage(null);
          requestNavigation(() => router.push("/home/notifications"));
        }}
      >
        <strong className="block text-sm">{message.title}</strong>
        <span className="mt-1 block text-xs">{message.body}</span>
      </button>
      <button
        type="button"
        className="mt-2 min-h-11 text-xs text-[#c7baff]"
        onClick={() => setMessage(null)}
      >
        닫기
      </button>
    </div>
  ) : null;
}
