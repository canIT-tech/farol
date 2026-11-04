import type { MetadataRoute } from "next";
import { absoluteUrl, resolveSiteUrl } from "../lib/seo";
import { GUIDES } from "./destinations/_catalog";

// Só páginas públicas com conteúdo. A área logada fica de fora (e com noindex).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const url = (path: string) => absoluteUrl(base, path);
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/destinations"), changeFrequency: "weekly", priority: 0.9 },
    ...GUIDES.map((guide) => ({
      url: url(`/destinations/${guide.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8
    })),
    { url: url("/terms"), changeFrequency: "yearly", priority: 0.2 },
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 }
  ];
}
