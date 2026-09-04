import { test, expect } from "@playwright/test";
import {
  API,
  TRIP_ID,
  flightOffer,
  hotelOffer,
  installSession,
  itinerary,
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
      return route.fulfill(
        json({
          ...trip,
          dateStart: "2026-05-10",
          dateEnd: "2026-05-17",
          targetMonth: null,
          destinations: [lisboa],
          chosenDestination: lisboa
        })
      );
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
    if (path === `${base}/itinerary`) return route.fulfill(json(itinerary("ready")));
    return route.continue();
  });
});

test("mostra voo, aeroporto vizinho e quando sai mais barato", async ({ page }) => {
  await page.goto(`/trips/${TRIP_ID}/booking`);

  await expect(page.getByRole("heading", { name: "Voo & hotel" })).toBeVisible();
  await expect(
    page.getByText(
      "Melhores opções para 10 – 17 de maio, GRU → LIS. A reserva é concluída no site do parceiro."
    )
  ).toBeVisible();

  // Cartão de voo no formato do hi-fi: horários, rota com nome, duração, preço.
  const voos = page.getByRole("region", { name: "Voos" });
  await expect(voos.getByText("18:05 → 07:15")).toBeVisible();
  await expect(
    voos.getByText("TAP Air Portugal · 4 de nov · GRU São Paulo — Guarulhos → LIS Lisboa")
  ).toBeVisible();
  await expect(voos.getByText("R$ 3.198")).toBeVisible();
  await expect(voos.getByText("só ida / pessoa")).toBeVisible();
  await expect(voos.getByRole("link", { name: "abre no Aviasales ↗" })).toBeVisible();
  await expect(page.getByText(/Preço aproximado/).first()).toBeVisible();

  // Alternativa de aeroporto vizinho: outro aeroporto de origem, mais barata.
  const vizinhos = page.getByRole("region", { name: "Aeroportos vizinhos" });
  await expect(vizinhos.getByText("R$ 2.890")).toBeVisible();
  await expect(vizinhos.getByText(/VCP Campinas/)).toBeVisible();
  await expect(vizinhos.getByText("1 escala")).toBeVisible();

  // Contexto de preço.
  await expect(page.getByRole("heading", { name: "Quando sai mais barato" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Melhor mês" })).toBeVisible();
  await expect(page.getByText(/dez.* de 2026/).first()).toBeVisible();
  await expect(page.getByText(/18 de nov/).first()).toBeVisible();
  await expect(page.getByText(/esta rota saiu entre/)).toBeVisible();
});

test("a aba de hotéis troca o conteúdo do miolo", async ({ page }) => {
  await page.goto(`/trips/${TRIP_ID}/booking`);

  await expect(page.getByRole("tab", { name: "Voos" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Hospedagem" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Hotéis" }).click();

  await expect(page.getByRole("tab", { name: "Hotéis" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Hospedagem" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hotel do Chiado" })).toBeVisible();
  await expect(page.getByText("4.5 ★")).toBeVisible();
  await expect(page.getByText("/noite")).toBeVisible();
  await expect(page.getByRole("img", { name: "Foto do Hotel do Chiado" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Voos" })).toHaveCount(0);
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
