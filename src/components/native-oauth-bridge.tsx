"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { parseNativeOAuthCallback } from "@/lib/native-oauth-callback";
import { getPendingNativeOAuthAttempt } from "@/lib/oauth";

const HANDLED_URL_KEY = "speakai.native-oauth.handled-url";

export function NativeOAuthBridge() {
  const router = useRouter();
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let listener: PluginListenerHandle | undefined;

    const handleUrl = ({ url }: URLOpenListenerEvent) => {
      if (
        !active ||
        handledUrl.current === url ||
        window.sessionStorage.getItem(HANDLED_URL_KEY) === url
      ) {
        return;
      }
      const callback = parseNativeOAuthCallback(url);
      if (!callback) return;
      const state = callback.searchParams.get("state");
      if (!state || !getPendingNativeOAuthAttempt(callback.provider, state))
        return;
      handledUrl.current = url;
      window.sessionStorage.setItem(HANDLED_URL_KEY, url);
      callback.searchParams.set("native_return", "1");
      // Closing the native sheet must not block code exchange. Keep the
      // WebView alive so pending bridge calls and app state survive navigation.
      void Browser.close().catch(() => undefined);
      router.replace(
        `/oauth/${callback.provider.toLowerCase()}/callback?${callback.searchParams.toString()}`,
      );
    };

    void App.addListener("appUrlOpen", handleUrl).then((handle) => {
      if (active) listener = handle;
      else void handle.remove();
    });
    void App.getLaunchUrl().then((launch) => {
      if (launch?.url) void handleUrl({ url: launch.url });
    });

    return () => {
      active = false;
      void listener?.remove();
    };
  }, [router]);

  return null;
}
