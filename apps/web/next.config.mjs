/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sem "X-Powered-By: Next.js": não ajuda ninguém e entrega a stack.
  poweredByHeader: false,
  // Browsers e alguns crawlers pedem /favicon.ico direto, sem ler o <head>.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/apple-icon" }];
  },
  experimental: { externalDir: true },
  // Os textos legais (docs/legal/*.md) entram no bundle como string, em build:
  // uma fonte só para o repo e para as páginas /termos e /privacidade.
  // O catálogo de destinos (packages/db/data/destinations.csv) vira os guias
  // públicos de /destinations do mesmo jeito: a fonte é o CSV curado.
  webpack(config) {
    config.module.rules.push({ test: /\.(md|csv)$/, type: "asset/source" });
    return config;
  }
};

export default nextConfig;
