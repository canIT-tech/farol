import { describe, it, expect, vi } from "vitest";
import {
  chooseDestination,
  createTrip,
  getFlightCalendar,
  getFlightDirections,
  getFlightLatest,
  getFlightMonths,
  getFlightNearby,
  getFlights,
  getHotels,
  getItinerary,
  getTrip,
  listTrips,
  regenerateDay,
  runDiscovery,
  selectFlight,
  selectHotel,
  sendChat,
  swapRestaurant
} from "./trip-api";

const TOKEN = "token-de-teste";
const TRIP_ID = "11111111-1111-4111-8111-111111111111";

const trip = {
  id: TRIP_ID,
  userId: "22222222-2222-4222-8222-222222222222",
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

const candidate = {
  iata: "LIS",
  city: "Lisboa",
  country: "Portugal",
  score: 0.82,
  rationale: "Justificativa longa o suficiente para passar no schema de candidato.",
  estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
  climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
  flightTimeHours: null
};

const item = {
  id: "33333333-3333-4333-8333-333333333333",
  slot: "morning",
  type: "activity",
  title: "Passeio pela Alfama",
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
};

const itinerary = {
  id: "44444444-4444-4444-8444-444444444444",
  tripId: TRIP_ID,
  version: 1,
  status: "ready",
  error: null,
  generatedAt: null,
  days: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      dayIndex: 1,
      date: null,
      notes: null,
      items: [item]
    }
  ]
};

function jsonFetch(payload: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" }
    })
  ) as unknown as typeof fetch;
}

function emptyFetch(status = 202) {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

function lastCall(f: typeof fetch): [string, RequestInit] {
  const mock = f as unknown as { mock: { calls: [string, RequestInit][] } };
  return mock.mock.calls[0]!;
}

describe("leitura", () => {
  it("getTrip valida o TripState devolvido", async () => {
    const f = jsonFetch({ ...trip, destinations: [candidate], chosenDestination: null });
    const state = await getTrip(TOKEN, TRIP_ID, f);
    expect(state.destinations[0]!.iata).toBe("LIS");
    const [url, init] = lastCall(f);
    expect(url).toContain(`/trips/${TRIP_ID}`);
    expect(init.method).toBe("GET");
  });

  it("getTrip rejeita payload fora do schema", async () => {
    await expect(getTrip(TOKEN, TRIP_ID, jsonFetch({ id: "x" }))).rejects.toThrow();
  });

  it("listTrips devolve a lista", async () => {
    expect(await listTrips(TOKEN, jsonFetch([trip]))).toHaveLength(1);
  });

  it("getItinerary valida o roteiro", async () => {
    const got = await getItinerary(TOKEN, TRIP_ID, jsonFetch(itinerary));
    expect(got.status).toBe("ready");
    expect(got.days[0]!.items[0]!.title).toBe("Passeio pela Alfama");
  });

  it("getFlights valida a seção do provider", async () => {
    const section = { offers: [], stale: false, error: "unavailable" };
    expect((await getFlights(TOKEN, TRIP_ID, jsonFetch(section))).error).toBe("unavailable");
  });

  it("getHotels valida a seção do provider", async () => {
    const section = { offers: [], stale: true, error: null };
    expect((await getHotels(TOKEN, TRIP_ID, jsonFetch(section))).stale).toBe(true);
  });
});

describe("escrita", () => {
  it("createTrip manda o input e valida a viagem", async () => {
    const f = jsonFetch(trip, 201);
    const input = {
      originIata: "GRU",
      party: { adults: 2, children: 0 },
      budgetTotal: 12000,
      currency: "BRL",
      durationDays: 7,
      targetMonth: "2026-09"
    };
    expect((await createTrip(TOKEN, input, f)).id).toBe(TRIP_ID);
    const [url, init] = lastCall(f);
    expect(url).toContain("/trips");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).originIata).toBe("GRU");
  });

  it("runDiscovery devolve os candidatos", async () => {
    const f = jsonFetch([candidate]);
    expect(await runDiscovery(TOKEN, TRIP_ID, f)).toHaveLength(1);
    expect(lastCall(f)[0]).toContain(`/trips/${TRIP_ID}/discovery`);
  });

  it("chooseDestination devolve o id do roteiro criado", async () => {
    const f = jsonFetch({ itineraryId: itinerary.id }, 202);
    expect((await chooseDestination(TOKEN, TRIP_ID, "LIS", f)).itineraryId).toBe(itinerary.id);
    expect(JSON.parse(lastCall(f)[1].body as string).iata).toBe("LIS");
  });

  it("swapRestaurant devolve o item novo", async () => {
    const f = jsonFetch({ ...item, type: "meal", title: "Cervejaria Ramiro" });
    const got = await swapRestaurant(TOKEN, TRIP_ID, item.id, { cuisine: "portuguesa" }, f);
    expect(got.title).toBe("Cervejaria Ramiro");
    expect(lastCall(f)[0]).toContain(`/itinerary/items/${item.id}/swap-restaurant`);
  });

  it("sendChat devolve a resposta do assessor", async () => {
    const payload = {
      message: { role: "assistant", content: "Tirei o museu do dia 2." },
      tripState: {}
    };
    const f = jsonFetch(payload);
    expect((await sendChat(TOKEN, TRIP_ID, "tira o museu", f)).message.content).toBe(
      "Tirei o museu do dia 2."
    );
    expect(JSON.parse(lastCall(f)[1].body as string).message).toBe("tira o museu");
  });
});

describe("rotas sem corpo de resposta", () => {
  it("regenerateDay não tenta parsear o 202 vazio", async () => {
    const f = emptyFetch();
    await expect(regenerateDay(TOKEN, TRIP_ID, 2, f)).resolves.toBeUndefined();
    expect(lastCall(f)[0]).toContain("/itinerary/days/2/regenerate");
  });

  it("selectFlight manda o offerId", async () => {
    const f = emptyFetch(201);
    await selectFlight(TOKEN, TRIP_ID, "offer-1", f);
    expect(JSON.parse(lastCall(f)[1].body as string).offerId).toBe("offer-1");
  });

  it("selectHotel manda o offerId", async () => {
    const f = emptyFetch(201);
    await selectHotel(TOKEN, TRIP_ID, "hotel-1", f);
    expect(lastCall(f)[0]).toContain(`/trips/${TRIP_ID}/hotels/select`);
  });

  it("propaga erro HTTP", async () => {
    const f = vi.fn(async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    await expect(regenerateDay(TOKEN, TRIP_ID, 1, f)).rejects.toThrow(/503/);
  });
});

const flightOffer = {
  id: "np:SAO:LIS:2026-11-04T18:05:00-03:00:3198",
  price: 3198,
  currency: "brl",
  carrier: "TP",
  carrierName: "TAP Air Portugal",
  originIata: "SAO",
  originName: null,
  destinationIata: "LIS",
  destinationName: "Lisboa",
  stops: 0,
  departAt: "2026-11-04T18:05:00-03:00",
  arriveAt: "2026-11-05T07:15:00.000Z",
  returnAt: null,
  durationMinutes: 610,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
};

const sample = {
  origin: "SAO",
  destination: "LIS",
  departDate: "2026-11-04",
  returnDate: null,
  price: 3198,
  currency: "brl",
  transfers: 0,
  durationMinutes: 610,
  gate: "Trip.com",
  foundAt: "2026-08-29T04:34:14Z",
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
};

const deal = {
  key: "2026-11",
  origin: "SAO",
  destination: "LIS",
  airline: "TP",
  departAt: "2026-11-04T18:05:00-03:00",
  returnAt: null,
  price: 3198,
  currency: "brl",
  flightNumber: "748",
  transfers: 0,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
};

const section = <T,>(offers: T[]) => ({ offers, stale: false, fetchedAt: null, error: null });

describe("contexto de preço do voo", () => {
  it("getFlightNearby chama /flights/nearby e valida as ofertas", async () => {
    const f = jsonFetch(section([flightOffer]));
    await expect(getFlightNearby(TOKEN, TRIP_ID, f)).resolves.toEqual(section([flightOffer]));
    expect(lastCall(f)[0]).toContain(`/trips/${TRIP_ID}/flights/nearby`);
  });

  it("getFlightCalendar e getFlightLatest devolvem amostras de preço", async () => {
    const calendar = jsonFetch(section([sample]));
    await expect(getFlightCalendar(TOKEN, TRIP_ID, calendar)).resolves.toEqual(section([sample]));
    expect(lastCall(calendar)[0]).toContain("/flights/calendar");

    const latest = jsonFetch(section([sample]));
    await expect(getFlightLatest(TOKEN, TRIP_ID, latest)).resolves.toEqual(section([sample]));
    expect(lastCall(latest)[0]).toContain("/flights/latest");
  });

  it("getFlightMonths e getFlightDirections devolvem achados por chave", async () => {
    const months = jsonFetch(section([deal]));
    await expect(getFlightMonths(TOKEN, TRIP_ID, months)).resolves.toEqual(section([deal]));
    expect(lastCall(months)[0]).toContain("/flights/months");

    const directions = jsonFetch(section([deal]));
    await expect(getFlightDirections(TOKEN, TRIP_ID, directions)).resolves.toEqual(section([deal]));
    expect(lastCall(directions)[0]).toContain("/flights/directions");
  });

  it("rejeita payload fora do schema", async () => {
    await expect(
      getFlightMonths(TOKEN, TRIP_ID, jsonFetch(section([{ key: "2026-11" }])))
    ).rejects.toThrow();
  });
});
