import { test, expect } from "@playwright/test";
import {
  API,
  TRIP_ID,
  flightOffer,
  hotelOffer,
  installSession,
  json,
  lisboa,
  nearbyOffer,
  priceSample,
  routeDeal,
  section,
  trip
} from "./fixtures/test-session";

// Tela "como chegar e onde ficar" com os dados do Travelpayouts: ofertas,
// aeroporto vizinho e o contexto de preço (melhor mês, melhor dia, faixa).
test.beforeEach(async ({ page }) => {
  await installSession(page);
  await page.route(`${API}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const base = `/api/trips/${TRIP_ID}`;

    if (path === base) {
      return route.fulfill(json({ ...trip, destinations: [lisboa], chosenDestination: lisboa }));
    }
    if (path === `${base}/flights`) return route.fulfill(json(section([flightOffer])));
    if (path === `${base}/flights/nearby`) return route.fulfill(json(section([nearbyOffer])));
    if (path === `${base}/flights/calendar`) {
      return route.fulfill(json(section([priceSample("2026-11-04", 3400), priceSample("2026-11-18", 2750)])));
    }
    if (path === `${base}/flights/latest`) {
      return route.fulfill(json(section([priceSample("2026-09-01", 2600), priceSample("2026-10-02", 5100)])));
    }
    if (path === `${base}/flights/months`) {
      return route.fulfill(json(section([routeDeal("2026-11", 3198), routeDeal("2026-12", 2480)])));
    }
    if (path === `${base}/hotels`) return route.fulfill(json(section([hotelOffer])));
    return route.continue();
  });
});

test("mostra voo, aeroporto vizinho e quando sai mais barato", async ({ page }) => {
  await page.goto(`/trips/${TRIP_ID}/booking`);

  await expect(page.getByRole("heading", { name: "Como chegar e onde ficar" })).toBeVisible();

  // Oferta principal, com o aviso de preço aproximado que a fonte cacheada exige.
  await expect(
    page.getByRole("region", { name: "Voos" }).getByRole("heading", { name: "TP" })
  ).toBeVisible();
  await expect(page.getByText(/Preço aproximado/).first()).toBeVisible();

  // Alternativa de aeroporto vizinho, mais barata.
  const vizinhos = page.getByRole("region", { name: "Aeroportos vizinhos" });
  await expect(vizinhos.getByRole("heading", { name: "AD" })).toBeVisible();

  // Contexto de preço.
  await expect(page.getByRole("heading", { name: "Quando sai mais barato" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Melhor mês" })).toBeVisible();
  await expect(page.getByText(/dez.* de 2026/).first()).toBeVisible();
  await expect(page.getByText(/18 de nov/).first()).toBeVisible();
  await expect(page.getByText(/esta rota saiu entre/)).toBeVisible();
});

test("some com o contexto de preço quando o provider está fora do ar", async ({ page }) => {
  await page.route(`${API}/trips/${TRIP_ID}/flights/months`, (route) =>
    route.fulfill(json(section([], "unavailable")))
  );
  await page.route(`${API}/trips/${TRIP_ID}/flights/latest`, (route) =>
    route.fulfill(json(section([], "unavailable")))
  );

  await page.goto(`/trips/${TRIP_ID}/booking`);

  await expect(page.getByRole("heading", { name: "Melhor dia do mês" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Melhor mês" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Faixa recente" })).toHaveCount(0);
});
