import type { Page } from "@playwright/test";

const SUPABASE_STORAGE_KEY = "sb-localhost-auth-token";

// Interceptar por origem da API, nao por glob de caminho: "**/trips**" tambem
// casa com a navegacao do Next em localhost:3000 e devolve JSON no lugar da pagina.
export const API = "http://localhost:3333";

export const TRIP_ID = "11111111-1111-4111-8111-111111111111";
export const USER_ID = "22222222-2222-4222-8222-222222222222";

function fakeJwt(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 60 * 60;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, email: "e2e@farol.test", role: "authenticated", exp })}.sig`;
}

export function fakeSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeJwt(),
    refresh_token: "refresh-e2e",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: {
      id: USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: "e2e@farol.test",
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(now * 1000).toISOString()
    }
  };
}

export async function installSession(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, session]) => {
      window.localStorage.setItem(key as string, JSON.stringify(session));
    },
    [SUPABASE_STORAGE_KEY, fakeSession()]
  );
}

export const trip = {
  id: TRIP_ID,
  userId: USER_ID,
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: null,
  dateEnd: null,
  durationDays: 7,
  targetMonth: "2026-09",
  party: { adults: 2, children: 0 },
  budgetTotal: 12000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z"
};

export const lisboa = {
  iata: "LIS",
  city: "Lisboa",
  country: "Portugal",
  score: 0.91,
  rationale: "Combina com gastronomia e caminhada, e cabe no orçamento que você deu.",
  estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
  climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
  flightTimeHours: null
};

export const recife = {
  ...lisboa,
  iata: "REC",
  city: "Recife",
  country: "Brasil",
  score: 0.78,
  estCost: { flight: 900, lodgingPerNight: 150, dailyLocal: 80, currency: "BRL" }
};

export function itinerary(status: "pending" | "ready") {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    tripId: TRIP_ID,
    version: 1,
    status,
    error: null,
    generatedAt: null,
    days:
      status === "ready"
        ? [
            {
              id: "55555555-5555-4555-8555-555555555555",
              dayIndex: 1,
              date: null,
              notes: null,
              items: [
                {
                  id: "66666666-6666-4666-8666-666666666666",
                  slot: "morning",
                  type: "activity",
                  title: "Caminhada pela Alfama",
                  description: null,
                  placeId: null,
                  lat: null,
                  lng: null,
                  rating: null,
                  durationMin: null,
                  estCost: null,
                  sortOrder: 0,
                  pinned: false,
                  needsReview: false
                }
              ]
            }
          ]
        : []
  };
}

export function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}
