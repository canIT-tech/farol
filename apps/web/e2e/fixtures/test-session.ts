import type { Page } from "@playwright/test";

const SUPABASE_STORAGE_KEY = "sb-localhost-auth-token";

// Interceptar por origem da API, nao por glob de caminho: "**/trips**" tambem
// casa com a navegacao do Next em localhost:3000 e devolve JSON no lugar da pagina.
export const API = "http://localhost:3333/api";

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

// ── Reserva (Passo 10 — Travelpayouts) ──────────────────────────────────────

export const flightOffer = {
  id: "np:SAO:LIS:2026-11-04T18:05:00-03:00:3198",
  price: 3198,
  currency: "brl",
  carrier: "TP",
  carrierName: "TAP Air Portugal",
  originIata: "GRU",
  originName: "São Paulo — Guarulhos",
  destinationIata: "LIS",
  destinationName: "Lisboa",
  stops: 0,
  departAt: "2026-11-04T18:05:00-03:00",
  arriveAt: "2026-11-05T07:15:00.000Z",
  returnAt: null,
  durationMinutes: 610,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
};

export const nearbyOffer = {
  ...flightOffer,
  id: "np:VCP:LIS:2026-11-04T20:00:00-03:00:2890",
  price: 2890,
  carrier: "AD",
  carrierName: "Azul",
  originIata: "VCP",
  originName: "Campinas — Viracopos",
  departAt: "2026-11-04T20:00:00-03:00",
  arriveAt: "2026-11-05T09:30:00+00:00",
  stops: 1
};

export const priceSample = (departDate: string, price: number) => ({
  origin: "SAO",
  destination: "LIS",
  departDate,
  returnDate: null,
  price,
  currency: "brl",
  transfers: 0,
  durationMinutes: 610,
  gate: "Trip.com",
  foundAt: null,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
});

export const routeDeal = (key: string, price: number) => ({
  key,
  origin: "SAO",
  destination: "LIS",
  airline: "TP",
  departAt: `${key}-04T18:05:00-03:00`,
  returnAt: null,
  price,
  currency: "brl",
  flightNumber: "748",
  transfers: 0,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
});

export const hotelOffer = {
  id: "htl-1",
  name: "Hotel do Chiado",
  region: "Chiado",
  pricePerNight: 480,
  priceTotal: 3360,
  currency: "BRL",
  rating: 4.5,
  deepLink: "https://exemplo.test/hotel"
};

export function section<T>(offers: T[], error: "unavailable" | null = null) {
  return { offers, stale: false, fetchedAt: new Date().toISOString(), error };
}
