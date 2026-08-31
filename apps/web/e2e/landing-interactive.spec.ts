import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/waitlist/count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 41 })
    });
  });
  await page.goto("/");
});

test("demo de gosto troca o destino ao selecionar um gosto", async ({ page }) => {
  const city = page.locator(".result .city");
  await expect(city).toHaveText("Cartagena");
  await page.locator("#experimente").getByRole("button", { name: "Natureza" }).click();
  await expect(city).toHaveText("Cidade do Cabo");
});

test("demo de chat responde e altera o plano", async ({ page }) => {
  await page.getByRole("button", { name: "Troca por um lugar mais tranquilo" }).click();
  await expect(page.locator(".cd-plan .match")).toHaveText("82% de aderência");
  await expect(page.getByText("R$ 5.200 / pessoa")).toBeVisible();
});

test("alternância de modo troca o conteúdo", async ({ page }) => {
  await page.getByRole("tab", { name: "Modo autônomo" }).click();
  await expect(page.getByRole("heading", { name: "Entrada mínima" })).toBeVisible();
});

test("fluxo: escolher gosto e ritmo e avançar para o passo 2", async ({ page }) => {
  const flow = page.locator("#experiencia");
  await flow.getByRole("button", { name: "Natureza" }).click();
  await flow.getByRole("radio", { name: "Intenso" }).click();
  await flow.getByRole("button", { name: "Continuar", exact: true }).click();

  await expect(flow.getByRole("button", { name: "Escolher destino" })).toHaveAttribute(
    "aria-current",
    "step"
  );
  await expect(flow.locator(".flow-pick").first()).toBeVisible();
});

test("fluxo: escolher um destino leva ao roteiro", async ({ page }) => {
  const flow = page.locator("#experiencia");
  await flow.getByRole("button", { name: "Continuar", exact: true }).click();
  await flow.locator(".flow-pick").first().click();

  await expect(flow.getByRole("button", { name: "Roteiro" })).toHaveAttribute(
    "aria-current",
    "step"
  );
  await expect(flow.locator(".mini-h")).toContainText("7 dias");
});

test("fluxo: voltar retorna ao passo anterior", async ({ page }) => {
  const flow = page.locator("#experiencia");
  await flow.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(flow.getByRole("button", { name: "Escolher destino" })).toHaveAttribute(
    "aria-current",
    "step"
  );
  await flow.getByRole("button", { name: "Voltar" }).click();
  await expect(flow.getByRole("button", { name: "Perfil de gosto" })).toHaveAttribute(
    "aria-current",
    "step"
  );
});
