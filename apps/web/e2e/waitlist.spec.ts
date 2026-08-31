import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/waitlist/count", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 41 })
    });
  });
});

test("cadastro na lista de espera mostra confirmação e incrementa o contador", async ({ page }) => {
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
  await expect(page.getByText("41 pessoas já na lista.").first()).toBeVisible();

  await page.getByLabel("E-mail").first().fill("primeiro@farol.app");
  await page.getByRole("button", { name: "Quero ser dos primeiros" }).first().click();

  await expect(page.getByText("Você está na lista")).toBeVisible();
  await expect(page.getByText("42 pessoas já na lista.").first()).toBeVisible();
  expect(posted).toEqual({ email: "primeiro@farol.app", source: "landing-hero" });
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
