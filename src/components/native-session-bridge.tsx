"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { App, type AppState } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { ApiError, api } from "@/lib/api";
import { enableNativeSessionRecovery, getAccessToken } from "@/lib/api/client";

const BACKGROUND_REFRESH_AFTER_MS = 5 * 60 * 1_000;

export function NativeSessionBridge() {
  const router = useRouter();
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    enableNativeSessionRecovery();

    let active = true;
    let listener: PluginListenerHandle | undefined;

    const handleAppState = ({ isActive }: AppState) => {
      if (!isActive) {
        backgroundedAt.current = Date.now();
        return;
      }

      const startedAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (
        startedAt === null ||
        Date.now() - startedAt < BACKGROUND_REFRESH_AFTER_MS ||
        !getAccessToken()
      ) {
        return;
      }

      // Refresh while the native app is becoming active, so the first user
      // action does not have to wait for a failed request and token rotation.
      void api.auth.refresh().catch((reason: unknown) => {
        if (active && reason instanceof ApiError && reason.status === 401) {
          router.replace("/");
        }
      });
    };

    void App.addListener("appStateChange", handleAppState).then((handle) => {
      if (active) listener = handle;
      else void handle.remove();
    });

    return () => {
      active = false;
      void listener?.remove();
    };
  }, [router]);

  return null;
}
