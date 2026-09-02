import { test, expect } from "@playwright/test";

test("cadastro na lista de espera troca o formulário pelo card de confirmação", async ({ page }) => {
  let posted: unknown = null;
  await page.route("**/waitlist", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    posted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, created: true })
    });
  });

  await page.goto("/");
  const hero = page.locator(".hero");
  await hero.getByLabel("E-mail").fill("primeiro@farol.app");
  await hero.getByRole("button", { name: "Quero ser dos primeiros" }).click();

  await expect(hero.getByText("Você está na lista.")).toBeVisible();
  await expect(hero.getByText("primeiro@farol.app")).toBeVisible();
  await expect(hero.getByLabel("E-mail")).toHaveCount(0);
  expect(posted).toEqual({ email: "primeiro@farol.app", source: "landing-hero" });
});

test("e-mail já cadastrado também confirma, com a mensagem de repetido", async ({ page }) => {
  await page.route("**/waitlist", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, created: false })
    });
  });

  await page.goto("/");
  await page.getByLabel("E-mail").first().fill("repetido@farol.app");
  await page.getByRole("button", { name: "Quero ser dos primeiros" }).first().click();

  await expect(page.getByText("já estava na lista")).toBeVisible();
});

test("e-mail inválido não chama a API e mostra erro", async ({ page }) => {
  let called = false;
  await page.route("**/waitlist", async (route) => {
    if (route.request().method() === "POST") called = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, created: true })
    });
  });

  await page.goto("/");
  await page.getByLabel("E-mail").first().fill("sem-arroba");
  await page.getByRole("button", { name: "Quero ser dos primeiros" }).first().click();

  await expect(page.getByText("Confere o e-mail")).toBeVisible();
  expect(called).toBe(false);
});

test("falha da API mostra erro e mantém o formulário", async ({ page }) => {
  await page.route("**/waitlist", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto("/");
  await page.getByLabel("E-mail").first().fill("ana@farol.app");
  await page.getByRole("button", { name: "Quero ser dos primeiros" }).first().click();

  await expect(page.getByText("Não deu para salvar agora")).toBeVisible();
  await expect(page.getByLabel("E-mail").first()).toBeVisible();
});
