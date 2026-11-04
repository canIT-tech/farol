import { test, expect, type Page } from "@playwright/test";

// SEO técnico: o que o Google lê antes de qualquer clique. Relatórios em docs/seo/.

async function jsonLdTypes(page: Page): Promise<string[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => (JSON.parse(text) as { "@type": string })["@type"]);
}

test.describe("SEO da home", () => {
  test("título, descrição, canonical e Open Graph com a palavra-chave", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/planejador de viagem/i);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /planejador de viagem/i);
    // O Next escreve a raiz sem a barra final; para o Google, com e sem barra é a mesma URL.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /planejador de viagem/i);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pt_BR");
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  });

  test("H1 com a palavra-chave e FAQ visível", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Planejador de viagem");
    await expect(page.getByRole("heading", { name: "Perguntas frequentes" })).toBeVisible();
    await expect(page.getByText("O que é um planejador de viagem com IA?")).toBeVisible();
  });

  test("dados estruturados: organização, site, app e FAQ", async ({ page }) => {
    await page.goto("/");
    const types = await jsonLdTypes(page);
    expect(types).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebApplication", "FAQPage"]));
  });

  test("liga para os guias de destino", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Lisboa/ }).first()).toHaveAttribute("href", "/destinations/lisboa");
  });

  test("sem erro de hidratação no console", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /hydrat|#418|did not match/i.test(msg.text())) errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
});

test.describe("arquivos de rastreamento", () => {
  test("robots.txt libera o site, fecha só a api e aponta o sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /api/");
    // área logada fica rastreável para o Google ler o noindex dela
    expect(body).not.toContain("Disallow: /trips");
    expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("sitemap.xml lista home, destinos e páginas legais, sem a área logada", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
    expect(body).toContain("/destinations</loc>");
    expect(body).toContain("/destinations/lisboa</loc>");
    expect(body).toContain("/terms</loc>");
    expect(body).not.toContain("/trips");
  });

  test("manifest e ícones respondem", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()) as { lang: string }).toMatchObject({ lang: "pt-BR" });
    expect((await request.get("/apple-icon")).headers()["content-type"]).toContain("image/png");
    expect((await request.get("/opengraph-image")).headers()["content-type"]).toContain("image/png");
    expect((await request.get("/favicon.ico")).status()).toBe(200);
  });
});

test.describe("guias de destino", () => {
  test("/destinations lista o catálogo por região", async ({ page }) => {
    const res = await page.goto("/destinations");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Destinos");
    await expect(page.getByRole("heading", { name: "Europa" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Lisboa/ }).first()).toBeVisible();
  });

  test("/destinations/lisboa tem título, quando ir, custo e dados estruturados", async ({ page }) => {
    const res = await page.goto("/destinations/lisboa");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/Roteiro em Lisboa/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Lisboa");
    await expect(page.getByText("Qual a melhor época para ir para Lisboa?")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/destinations\/lisboa$/);
    // openGraph da página não pode perder a imagem e o site da raiz
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Farol Viagens");
    const types = await jsonLdTypes(page);
    expect(types).toEqual(expect.arrayContaining(["TouristDestination", "BreadcrumbList", "FAQPage"]));
    await expect(page.getByRole("link", { name: /montar meu roteiro/ })).toBeVisible();
  });

  test("slug inexistente responde 404", async ({ page }) => {
    const res = await page.goto("/destinations/atlantida");
    expect(res?.status()).toBe(404);
  });
});

test.describe("noindex na área logada", () => {
  for (const path of ["/login", "/trips", "/onboarding", "/credits", "/auto"]) {
    test(`${path} não é indexável`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }

  test("páginas legais têm descrição própria", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Termos de Uso/);
    await page.goto("/privacy");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Política de Privacidade|dados/);
  });
});
