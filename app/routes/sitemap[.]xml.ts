import type { LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  const baseUrl = "https://xaosao.com";
  const today = new Date().toISOString().split("T")[0];

  const urls = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/model-auth/login", priority: "0.8", changefreq: "monthly" },
    { loc: "/model-auth/register", priority: "0.8", changefreq: "monthly" },
    { loc: "/auth/register", priority: "0.8", changefreq: "monthly" },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
