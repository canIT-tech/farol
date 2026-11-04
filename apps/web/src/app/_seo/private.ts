import type { Metadata } from "next";

// Área logada: rastreável, fora do índice. Título próprio para a aba não
// repetir o da landing. Ver NOINDEX_PATHS em lib/seo.ts.
export function privateMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false, googleBot: { index: false, follow: false } } };
}
