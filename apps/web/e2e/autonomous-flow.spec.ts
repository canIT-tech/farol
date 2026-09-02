import { test, expect } from "@playwright/test";
import { API, TRIP_ID, installSession, itinerary, json, lisboa, recife, trip } from "./fixtures/test-session";

const profile = {
  id: "77777777-7777-4777-8777-777777777777",
  userId: trip.userId,
  interests: ["praia", "gastronomia", "natureza"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {},
  updatedAt: "2026-09-01T00:00:00.000Z"
};

// Modo autônomo: entrada mínima → UM plano fechado. A pessoa nunca vê lista de
// destino; o ajuste é só pelo chat.
test("entrada mínima → plano único, sem seletor de destino", async ({ page }) => {
  await installSession(page);

  let profileBody: unknown = null;
  let chosenIata: string | null = null;

  // Um handler só: o Playwright casa rotas na ordem inversa de registro, então
  // um `${API}/**` registrado depois engoliria o handler de /me/profile.
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/me/profile" && method === "PUT") {
      profileBody = request.postDataJSON();
      return route.fulfill(json(profile));
    }
    if (url.pathname === "/api/trips" && method === "POST") {
      return route.fulfill(json(trip, 201));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/discovery` && method === "POST") {
      return route.fulfill(json([recife, lisboa]));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/destination` && method === "POST") {
      chosenIata = request.postDataJSON().iata;
      return route.fulfill(json({ itineraryId: itinerary("ready").id }, 202));
    }
    if (url.pathname === `/api/trips/${TRIP_ID}` && method === "GET") {
      return route.fulfill(
        json({ ...trip, destinations: [recife, lisboa], chosenDestination: lisboa })
      );
    }
    if (url.pathname === `/api/trips/${TRIP_ID}/itinerary` && method === "GET") {
      return route.fulfill(json(itinerary("ready")));
    }
    return route.continue();
  });

  await page.goto("/auto");
  await page.getByLabel("Saindo de").fill("GRU");
  await page.getByLabel("Ida").fill("2026-09-10");
  await page.getByLabel("Volta").fill("2026-09-17");
  for (const gosto of ["praia", "gastronomia", "natureza"]) {
    await page.getByRole("button", { name: gosto, exact: true }).click();
  }

  await page.getByRole("button", { name: "Montar meu plano" }).click();
  await page.waitForURL(`**/trips/${TRIP_ID}/itinerary`);

  await expect(page.getByRole("heading", { name: "Caminhada pela Alfama" })).toBeVisible({
    timeout: 15_000
  });

  // O melhor candidato foi escolhido sozinho: Lisboa (0.91) sobre Recife (0.78).
  expect(chosenIata).toBe("LIS");
  expect(profileBody).toMatchObject({ interests: ["praia", "gastronomia", "natureza"] });

  // Nenhuma lista de destino no caminho.
  await expect(page.getByRole("button", { name: "Ver roteiro" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Recife" })).toHaveCount(0);
});
