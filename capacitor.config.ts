/// <reference types="@capacitor/splash-screen" />

import type { CapacitorConfig } from "@capacitor/cli";

const nativeServerUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://vc-fe.vercel.app";
const parsedServerUrl = new URL(nativeServerUrl);

if (parsedServerUrl.protocol !== "https:") {
  throw new Error("CAPACITOR_SERVER_URL must use HTTPS.");
}

const config: CapacitorConfig = {
  appId: "site.voicecoaching.speakai",
  appName: "SPEAK AI",
  webDir: "capacitor-web",
  backgroundColor: "#f5f6f8",
  zoomEnabled: false,
  android: {
    allowMixedContent: false,
    backgroundColor: "#f5f6f8",
  },
  ios: {
    backgroundColor: "#f5f6f8",
    contentInset: "never",
    allowsLinkPreview: false,
  },
  server: {
    url: parsedServerUrl.toString(),
    cleartext: false,
    errorPath: "offline.html",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1_200,
      launchFadeOutDuration: 180,
      backgroundColor: "#336fffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
