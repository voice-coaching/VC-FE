"use client";

import { useEffect, useRef } from "react";
import { App, type URLOpenListenerEvent } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { parseNativeOAuthCallback } from "@/lib/native-oauth-callback";

const HANDLED_URL_KEY = "speakai.native-oauth.handled-url";

export function NativeOAuthBridge() {
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let listener: PluginListenerHandle | undefined;

    const handleUrl = async ({ url }: URLOpenListenerEvent) => {
      if (
        !active ||
        handledUrl.current === url ||
        window.sessionStorage.getItem(HANDLED_URL_KEY) === url
      ) {
        return;
      }
      const callback = parseNativeOAuthCallback(url);
      if (!callback) return;
      handledUrl.current = url;
      window.sessionStorage.setItem(HANDLED_URL_KEY, url);
      callback.searchParams.set("native_return", "1");
      await Browser.close().catch(() => undefined);
      window.location.replace(
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
  }, []);

  return null;
}
