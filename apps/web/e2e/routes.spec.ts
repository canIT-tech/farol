import { test, expect } from "@playwright/test";
import { API, installSession, json, routeDeal, section } from "./fixtures/test-session";

// Busca por rota livre: origem e destino quaisquer, sem catálogo e sem viagem.
// É a única porta para um destino que o catálogo não tem — SYD, por exemplo.

const OFFER = {
  id: "gf:LA:LA755-LA800:2027-02-11:6420",
  price: 6420,
  currency: "brl",
  carrier: "LA",
  carrierName: "LATAM",
  originIata: "FLN",
  originName: "Florianópolis",
  destinationIata: "SYD",
  destinationName: "Sydney",
  stops: 1,
  segments: [
    {
      fromIata: "FLN",
      fromName: "Florianópolis",
      toIata: "SCL",
      toName: "Santiago",
      departAt: "2027-02-11T06:15:00",
      arriveAt: "2027-02-11T10:40:00",
      durationMinutes: 265,
      flightNumber: "LA755"
    },
    {
      fromIata: "SCL",
      fromName: "Santiago",
      toIata: "SYD",
      toName: "Sydney",
      departAt: "2027-02-11T14:30:00",
      arriveAt: "2027-02-12T22:05:00",
      durationMinutes: 815,
      flightNumber: "LA800"
    }
  ],
  departAt: "2027-02-11T06:15:00",
  arriveAt: "2027-02-12T22:05:00",
  returnAt: null,
  durationMinutes: 2510,
  deepLink: "https://www.google.com/travel/flights?tfs=abc"
};

const MONTHS = section([routeDeal("2027-01", 9000), routeDeal("2027-02", 6420)]);

async function preencheRota(page: import("@playwright/test").Page) {
  await page.getByLabel("Origem").fill("FLN");
  await page.getByLabel("Destino").fill("SYD");
  await page.getByLabel("Viagem").selectOption("one-way");
  await page.getByRole("button", { name: "Buscar" }).click();
}

test.describe("busca por rota", () => {
  test("mês mais barato leva às ofertas, com o caminho visível", async ({ page }) => {
    await installSession(page);
    await page.route(`${API}/routes/months*`, (route) => route.fulfill(json(MONTHS)));
    await page.route(`${API}/routes/offers*`, (route) => route.fulfill(json(section([OFFER]))));

    await page.goto("/rotas");
    await preencheRota(page);

    await expect(page.getByTestId("month-list")).toBeVisible();
    await expect(page.getByTestId("cheapest-month")).toContainText("fevereiro de 2027");

    // Clicar no mês preenche a data e dispara o passo 2 sozinho.
    await page.getByTestId("cheapest-month").click();

    await expect(page.getByTestId("offer-list")).toBeVisible();
    await expect(page.getByTestId("offer-path")).toHaveText("FLN → SCL → SYD");
  });

  // Vazio não é falha: o /prices/monthly serve cache do parceiro, e uma rota que
  // quase ninguém pesquisa não tem linha. A tela diz isso em vez de trocar a
  // rota por um hub.
  test("rota sem histórico diz que não tem histórico", async ({ page }) => {
    await installSession(page);
    await page.route(`${API}/routes/months*`, (route) => route.fulfill(json(section([]))));

    await page.goto("/rotas");
    await preencheRota(page);

    await expect(page.getByRole("status")).toContainText(
      "sem histórico de preço para essa rota"
    );
  });

  test("rota incompleta não chega a chamar a api", async ({ page }) => {
    await installSession(page);
    let chamou = false;
    await page.route(`${API}/routes/**`, (route) => {
      chamou = true;
      return route.fulfill(json(section([])));
    });

    await page.goto("/rotas");
    await page.getByLabel("Origem").fill("FL");
    await page.getByLabel("Destino").fill("SYD");
    await page.getByRole("button", { name: "Buscar" }).click();

    // Não `getByRole("alert")`: o route announcer do Next também é role=alert.
    await expect(page.locator("p.screen__error")).toContainText("três letras");
    expect(chamou).toBe(false);
  });
});
