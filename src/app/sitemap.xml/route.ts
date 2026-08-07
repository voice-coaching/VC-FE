// TODO: replace with your project URL once a project name or custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export async function GET() {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/auth", changefreq: "monthly", priority: "0.6" },
    { path: "/onboarding", changefreq: "monthly", priority: "0.5" },
    { path: "/home", changefreq: "daily", priority: "0.9" },
    { path: "/news", changefreq: "daily", priority: "0.8" },
    { path: "/sentences", changefreq: "weekly", priority: "0.8" },
    { path: "/announcer", changefreq: "weekly", priority: "0.8" },
    { path: "/class", changefreq: "weekly", priority: "0.8" },
    { path: "/class/pronunciation", changefreq: "weekly", priority: "0.7" },
    { path: "/class/intonation", changefreq: "weekly", priority: "0.7" },
    { path: "/practice/custom", changefreq: "monthly", priority: "0.6" },
    { path: "/mypage", changefreq: "weekly", priority: "0.5" },
  ];
  const urls = entries.map((entry) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${entry.path}</loc>`,
      entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
      entry.priority ? `    <priority>${entry.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
  });
}
