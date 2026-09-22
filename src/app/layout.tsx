import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "../styles.css";
import { Providers } from "./providers";
import { NativeOAuthBridge } from "@/components/native-oauth-bridge";

const designFont = localFont({
  src: "../assets/fonts/NotoSansKR.woff",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: "SpeakAI · AI 발음 · 억양 트레이닝",
  description:
    "아나운서 문장을 따라 읽고 AI가 음절별 발음과 억양을 채점해주는 스피치 트레이닝 앱.",
  authors: [{ name: "SpeakAI" }],
  openGraph: {
    title: "SpeakAI · AI 발음 · 억양 트레이닝",
    description: "매일 3분, 뉴스 스크립트로 또렷한 말하기를 연습하세요.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#2f6bff",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className={designFont.className}>
        <Providers>
          <NativeOAuthBridge />
          {children}
        </Providers>
      </body>
    </html>
  );
}
