import { test, expect } from "@playwright/test";
import { API, TRIP_ID, installSession, json, lisboa, trip } from "./fixtures/test-session";

// Pagamento por viagem (spec 2026-09-15): selo no header, 402 na escolha do
// destino leva à compra, compra abre o checkout, sucesso volta para onde estava.
// A api entra stubbada na fronteira de rede, como nos demais specs.

const me = (credits: number, freeItineraryUsed: boolean) => ({
  credits,
  freeItineraryUsed,
  orders: []
});

const profile = {
  id: "11111111-1111-1111-1111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  interests: ["praia"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {},
  updatedAt: "2026-09-01T00:00:00.000Z"
};

test.describe("créditos", () => {
  test("header mostra a 1ª viagem grátis, depois o saldo", async ({ page }) => {
    await installSession(page);
    await page.route(`${API}/me/profile`, (route) => route.fulfill(json(profile)));
    await page.route(`${API}/trips`, (route) => route.fulfill(json([])));
    // Valor explícito, não contador de chamadas: em dev o React monta duas vezes.
    let current = me(0, false);
    await page.route(`${API}/payments/me`, (route) => route.fulfill(json(current)));

    await page.goto("/trips");
    await expect(page.getByTestId("credits-badge")).toHaveText("1ª viagem por nossa conta");

    current = me(2, true);
    await page.reload();
    await expect(page.getByTestId("credits-badge")).toHaveText("2 créditos");
    await expect(page.getByTestId("credits-badge")).toHaveAttribute("href", "/credits");
  });

  test("402 na escolha do destino leva para /credits com o caminho de volta", async ({ page }) => {
    await installSession(page);
    await page.route(`${API}/payments/me`, (route) => route.fulfill(json(me(0, true))));
    await page.route(`${API}/trips/${TRIP_ID}`, (route) =>
      route.fulfill(json({ ...trip, destinations: [lisboa], chosenDestination: null }))
    );
    await page.route(`${API}/trips/${TRIP_ID}/discovery`, (route) =>
      route.fulfill(json([lisboa]))
    );
    await page.route(`${API}/trips/${TRIP_ID}/destination`, (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          statusCode: 402,
          code: "payment_required",
          message: "sua primeira viagem foi por nossa conta — as próximas usam um crédito"
        })
      })
    );

    await page.goto(`/trips/${TRIP_ID}/discovery`);
    await page.getByRole("button", { name: "Ver roteiro" }).first().click();

    await expect(page).toHaveURL(/\/credits\?returnTo=%2Ftrips%2F.*discovery/);
    await expect(page.getByRole("heading", { name: /primeira viagem foi por nossa conta/ })).toBeVisible();
  });

  test("comprar o pacote chama o checkout e o sucesso volta para onde estava", async ({ page }) => {
    await installSession(page);
    let checkoutBody: unknown = null;
    let polls = 0;
    await page.route(`${API}/payments/me`, (route) =>
      route.fulfill(json(polls++ === 0 ? me(0, true) : me(3, true)))
    );
    await page.route(`${API}/payments/checkout`, (route) => {
      checkoutBody = route.request().postDataJSON();
      return route.fulfill(json({ url: "http://localhost:3100/payment/success" }, 201));
    });
    await page.route(`${API}/trips/${TRIP_ID}`, (route) =>
      route.fulfill(json({ ...trip, destinations: [lisboa], chosenDestination: null }))
    );
    await page.route(`${API}/trips/${TRIP_ID}/discovery`, (route) =>
      route.fulfill(json([lisboa]))
    );

    await page.goto(`/credits?returnTo=%2Ftrips%2F${TRIP_ID}%2Fdiscovery`);
    await page.getByTestId("plan-pack3").getByRole("button", { name: "Comprar" }).click();

    await expect(page).toHaveURL(/\/trips\/.*\/discovery/);
    expect(checkoutBody).toEqual({ product: "pack3" });
  });

  test("compra ainda fechada (503) diz isso em vez de erro", async ({ page }) => {
    await installSession(page);
    await page.route(`${API}/payments/me`, (route) => route.fulfill(json(me(0, true))));
    await page.route(`${API}/payments/checkout`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ statusCode: 503, code: "payment_not_configured", message: "x" })
      })
    );

    await page.goto("/credits");
    await page.getByTestId("plan-single").getByRole("button", { name: "Comprar" }).click();

    await expect(page.getByRole("status")).toContainText("ainda não está aberta");
  });

  test("cancelado não cobra e volta", async ({ page }) => {
    await installSession(page);
    await page.goto("/payment/cancelled");
    await expect(page.getByRole("heading", { name: /nada foi cobrado/ })).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click();
    await expect(page).toHaveURL(/\/trips$/);
  });
});
