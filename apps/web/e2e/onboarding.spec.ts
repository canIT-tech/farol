import { test, expect } from "@playwright/test";

const SUPABASE_STORAGE_KEY = "sb-localhost-auth-token";

function fakeJwt(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: "u-e2e", email: "e2e@farol.test", role: "authenticated", exp })}.sig`;
}

function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeJwt(),
    refresh_token: "refresh-e2e",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: "u-e2e",
      aud: "authenticated",
      role: "authenticated",
      email: "e2e@farol.test",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(now * 1000).toISOString()
    }
  };
}

const profileResponse = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-2222-2222-222222222222",
  interests: ["praia", "gastronomia", "vinhos"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {},
  updatedAt: "2026-08-29T12:00:00.000Z"
};

test("login mockado → onboarding → salva o perfil e redireciona", async ({ page }) => {
  await page.addInitScript(
    ([key, session]) => {
      window.localStorage.setItem(key as string, JSON.stringify(session));
    },
    [SUPABASE_STORAGE_KEY, fakeSession()]
  );

  let putBody: unknown = null;
  await page.route("**/me/profile", async (route) => {
    if (route.request().method() === "PUT") {
      putBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(profileResponse)
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/onboarding");

  await expect(page.getByRole("heading", { name: "Seu perfil de viagem" })).toBeVisible();

  for (const interest of ["praia", "gastronomia", "vinhos"]) {
    await page.getByRole("button", { name: interest, exact: true }).click();
  }
  await page.getByRole("radio", { name: "Moderado" }).click();
  await page.getByRole("radio", { name: "Casal" }).click();
  await page.getByRole("radio", { name: "Médio" }).click();

  const continuar = page.getByRole("button", { name: "Continuar" });
  await expect(continuar).toBeEnabled();
  await continuar.click();

  await page.waitForURL("http://localhost:3000/");
  expect(putBody).toEqual({
    interests: ["praia", "gastronomia", "vinhos"],
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio",
    constraints: {}
  });
});

test("sem sessão o onboarding manda para o login", async ({ page }) => {
  await page.goto("/onboarding");
  await page.waitForURL("**/login");
  await expect(page.getByRole("heading", { name: "Entrar no Farol" })).toBeVisible();
});
