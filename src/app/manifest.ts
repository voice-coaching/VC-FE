import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SpeakAI · AI 발음 · 억양 트레이닝",
    short_name: "SpeakAI",
    description:
      "아나운서 문장을 따라 읽고 AI가 음절별 발음과 억양을 채점해주는 스피치 트레이닝 앱.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2f6bff",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
