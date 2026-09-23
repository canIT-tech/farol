import { test, expect } from "@playwright/test";

// Termos e Privacidade são páginas públicas: a Stripe exige as duas para ativar
// a conta e para o aceite no checkout, e o texto vem de docs/legal em build.
test.describe("páginas legais", () => {
  test("/terms publica os Termos de Uso com a política de arrependimento", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Termos de Uso");
    await expect(page.getByText("7 (sete) dias", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("primeiro roteiro da sua conta")).toBeVisible();
  });

  test("/privacy publica a Política de Privacidade", async ({ page }) => {
    const res = await page.goto("/privacy");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Política de Privacidade");
    await expect(page.getByText("Stripe").first()).toBeVisible();
  });

  test("landing e login apontam para os dois", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer").getByRole("link", { name: "Termos" })).toHaveAttribute("href", "/terms");
    await expect(page.locator("footer").getByRole("link", { name: "Privacidade" })).toHaveAttribute(
      "href",
      "/privacy"
    );

    await page.goto("/login");
    await expect(page.getByRole("link", { name: "Termos" })).toHaveAttribute("href", "/terms");
  });
});
