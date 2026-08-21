import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: "또박 · AI 발음 · 억양 트레이닝",
  description:
    "아나운서 문장을 따라 읽고 AI가 음절별 발음과 억양을 채점해주는 스피치 트레이닝 앱.",
  authors: [{ name: "또박" }],
  openGraph: {
    title: "또박 · AI 발음 · 억양 트레이닝",
    description: "매일 3분, 뉴스 스크립트로 또렷한 말하기를 연습하세요.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
