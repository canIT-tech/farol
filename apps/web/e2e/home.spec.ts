import { test, expect } from "@playwright/test";
import { API, TRIP_ID, installSession, json, trip } from "./fixtures/test-session";

const profile = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  interests: ["praia", "gastronomia", "vinhos"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {},
  updatedAt: "2026-08-29T12:00:00.000Z"
};

// Navegação da área logada: landing → Minhas viagens → continuar uma viagem →
// sair. É o caminho que um usuário clica; antes só existia por URL digitada.
test("sem sessão a landing oferece Entrar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toHaveAttribute("href", "/login");
});

// Decreto 7.962/2013, art. 2º: identificação do fornecedor visível no site.
test("rodapé da landing identifica o fornecedor", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer")).toContainText("CNPJ 49.181.911/0001-51");
});

test("com sessão: landing → Minhas viagens → Continuar → Sair", async ({ page }) => {
  await installSession(page);

  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/me/profile") return route.fulfill(json(profile));
    if (url.pathname === "/api/trips") return route.fulfill(json([trip]));
    if (url.pathname === `/api/trips/${TRIP_ID}`) {
      return route.fulfill(json({ ...trip, destinations: [], chosenDestination: null }));
    }
    return route.continue();
  });
  // O logout do supabase-js bate no Auth; sem servidor local, respondemos nós.
  await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 204 }));

  await page.goto("/");
  await page.getByRole("link", { name: "Minhas viagens" }).click();
  await page.waitForURL("**/trips");

  await expect(page.getByRole("heading", { name: "Minhas viagens" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saindo de GRU" })).toBeVisible();
  await expect(page.getByText("set 2026 · 7 dias")).toBeVisible();

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(`**/trips/${TRIP_ID}/discovery`);
  await expect(
    page.getByRole("link", { name: "Minhas viagens", exact: true }).first()
  ).toHaveAttribute("href", "/trips");

  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/$/);
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
});

test("sem perfil de gosto, Minhas viagens manda para o onboarding", async ({ page }) => {
  await installSession(page);
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/me/profile") return route.fulfill(json({ message: "not found" }, 404));
    return route.continue();
  });

  await page.goto("/trips");
  await page.waitForURL("**/onboarding");
  await expect(page.getByRole("heading", { name: "O que te move numa viagem?" })).toBeVisible();
});

test("quem já tem sessão não vê o login", async ({ page }) => {
  await installSession(page);
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/me/profile") return route.fulfill(json(profile));
    if (url.pathname === "/api/trips") return route.fulfill(json([]));
    return route.continue();
  });

  await page.goto("/login");
  await page.waitForURL("**/trips");
  await expect(page.getByText("Você ainda não tem viagem.", { exact: false })).toBeVisible();
});

// Remover é irreversível e leva o roteiro junto, então o primeiro clique só
// arma a confirmação — um toque acidental não apaga nada.
test("remover pede confirmação, dá para desistir, e o cartão some ao confirmar", async ({
  page
}) => {
  await installSession(page);

  let deleted: string | null = null;
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/me/profile") return route.fulfill(json(profile));
    if (url.pathname === `/api/trips/${TRIP_ID}` && request.method() === "DELETE") {
      deleted = TRIP_ID;
      return route.fulfill({ status: 204, body: "" });
    }
    if (url.pathname === "/api/trips") {
      return route.fulfill(json(deleted === null ? [trip] : []));
    }
    return route.continue();
  });

  await page.goto("/trips");
  const cartao = page.getByRole("article").first();
  await expect(cartao).toBeVisible();

  await cartao.getByRole("button", { name: /^Remover/ }).click();
  await expect(page.getByText("Remover esta viagem?")).toBeVisible();

  // Desistir devolve o cartão ao estado normal, sem chamar a api.
  await cartao.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.getByText("Remover esta viagem?")).toHaveCount(0);
  await expect(cartao.getByRole("button", { name: "Continuar" })).toBeVisible();

  await cartao.getByRole("button", { name: /^Remover/ }).click();
  await cartao.getByRole("button", { name: "Sim, remover" }).click();

  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText(/ainda não tem viagem/)).toBeVisible();
});
