import type { MetadataRoute } from "next";
import { absoluteUrl, resolveSiteUrl, robotsRules } from "../lib/seo";

// Fonte única do robots.txt do Farol. O Cloudflare não injeta mais nada aqui
// (Bot Preference Sync desligado) e não bloqueia treino de IA na borda, porque
// isso barrava o Googlebot. Ver docs/seo/2026-11-03-relatorio-seo-final.md.
export default function robots(): MetadataRoute.Robots {
  const base = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  return {
    rules: robotsRules(),
    sitemap: absoluteUrl(base, "/sitemap.xml"),
    host: base
  };
}
