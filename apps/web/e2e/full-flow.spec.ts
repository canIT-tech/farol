import { test, expect } from "@playwright/test";
import {
  API,
  TRIP_ID,
  installSession,
  itinerary,
  json,
  lisboa,
  recife,
  trip
} from "./fixtures/test-session";

// Fluxo B2C padrão: nova viagem → descoberta → destino → roteiro → chat.
// A apps/api entra stubbada na fronteira de rede, como nos demais specs deste
// diretório. O E2E contra api e worker reais depende de um emissor de JWKS de
// teste no webServer — ver o adendo do plano do Passo 8.
test("nova viagem → descoberta → destino → roteiro → ajuste por chat", async ({ page }) => {
  await installSession(page);

  let chosenIata: string | null = null;
  let chatMessage: string | null = null;
  let itineraryCalls = 0;

  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/geo/whereami") {
      // O formulário sugere a origem pelo IP; aqui o palpite não resolve.
      return route.fulfill(json(null));
    }
    if (url.pathname === "/api/trips" && method === "POST") {
      return route.fulfill(json(trip, 201));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/discovery` && method === "POST") {
      return route.fulfill(json([lisboa, recife]));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}` && method === "GET") {
      return route.fulfill(
        json({
          ...trip,
          destinations: [lisboa, recife],
          chosenDestination: chosenIata === null ? null : lisboa
        })
      );
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/destination` && method === "POST") {
      chosenIata = request.postDataJSON().iata;
      return route.fulfill(json({ itineraryId: itinerary("pending").id }, 202));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/itinerary` && method === "GET") {
      itineraryCalls += 1;
      return route.fulfill(json(itinerary(itineraryCalls === 1 ? "pending" : "ready")));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/chat` && method === "POST") {
      chatMessage = request.postDataJSON().message;
      return route.fulfill(
        json({
          message: { role: "assistant", content: "Refiz a manhã do dia 1." },
          tripState: {}
        })
      );
    }
    return route.continue();
  });

  await page.goto("/trips/new");
  await page.getByLabel("Saindo de").fill("GRU");
  // O seletor de mês abre em 2026.
  await page.getByRole("button", { name: /^Mês/ }).click();
  await page.getByRole("button", { name: "set", exact: true }).click();
  await page.getByRole("button", { name: "Buscar destinos" }).click();

  await page.waitForURL(`**/trips/${TRIP_ID}/discovery`);
  await expect(page.getByRole("heading", { name: "Lisboa" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recife" })).toBeVisible();

  await page.getByRole("button", { name: "Ver roteiro" }).first().click();
  await page.waitForURL(`**/trips/${TRIP_ID}/itinerary`);

  await expect(page.getByText("Montando o roteiro…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Caminhada pela Alfama" })).toBeVisible({
    timeout: 15_000
  });
  expect(chosenIata).toBe("LIS");

  await page.getByRole("textbox").fill("refaz a manhã do dia 1");
  await page.getByRole("button", { name: /Enviar/ }).click();
  await expect(page.getByText("Refiz a manhã do dia 1.")).toBeVisible();
  expect(chatMessage).toBe("refaz a manhã do dia 1");
});
