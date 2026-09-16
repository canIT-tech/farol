/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { externalDir: true },
  // Os textos legais (docs/legal/*.md) entram no bundle como string, em build:
  // uma fonte só para o repo e para as páginas /termos e /privacidade.
  webpack(config) {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  }
};

export default nextConfig;
