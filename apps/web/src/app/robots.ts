import type { MetadataRoute } from "next";
import { CRAWL_BLOCKED_PATHS, absoluteUrl, resolveSiteUrl } from "../lib/seo";

// O Cloudflare antepõe as próprias regras (bloqueio de crawler de IA) a este
// arquivo quando o "AI Crawl Control → robots.txt gerenciado" está ligado.
// Isso é painel, não código; ver docs/seo/.
export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...CRAWL_BLOCKED_PATHS] }],
    sitemap: absoluteUrl(base, "/sitemap.xml"),
    host: base
  };
}
