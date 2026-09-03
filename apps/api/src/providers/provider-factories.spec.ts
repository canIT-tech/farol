import { describe, it, expect, vi, afterEach } from "vitest";
import { TravelpayoutsFlightProvider, TravelpayoutsGeoProvider, isPlacesProvider } from "@farol/providers";
import {
  createFlightProvider,
  createGeoProvider,
  createHotelProvider,
  createPlacesProvider
} from "./provider-factories";
import type { Env } from "../config/env.schema";

const env = {
  TRAVELPAYOUTS_TOKEN: "tok",
  TRAVELPAYOUTS_MARKER: "555",
  TRAVELPAYOUTS_BASE_URL: "https://tp.local",
  TRAVELPAYOUTS_CURRENCY: "usd",
  GEO_DUMP_TTL_SECONDS: 86_400,
  LITEAPI_BASE_URL: "https://lite.local",
  LITEAPI_KEY: "sand_x",
  LITEAPI_CURRENCY: "BRL",
  LITEAPI_GUEST_NATIONALITY: "BR",
  HOTEL_SEARCH_RADIUS_METERS: 5000,
  FLIGHT_DEEPLINK_TEMPLATE: "https://voo.local/{origin}-{destination}?p={passengers}&m={marker}",
  HOTEL_DEEPLINK_TEMPLATE: "https://hotel.local/{cityName}?q={hotelName}",
  GOOGLE_PLACES_KEY: "gkey"
} as unknown as Env;

// As factories só montam objetos; o que prova que a env chegou é a requisição
// que o provider dispara. Por isso os testes espionam o fetch global.
interface Recorded {
  url: string;
  init?: RequestInit;
}

function stubFetch(payload: unknown): Recorded[] {
  const calls: Recorded[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createFlightProvider", () => {
  it("monta o provider do Travelpayouts", () => {
    expect(createFlightProvider(env)).toBeInstanceOf(TravelpayoutsFlightProvider);
  });

  it("leva base url, token, moeda e template de deep link da env para a chamada", async () => {
    const calls = stubFetch({
      currency: "usd",
      data: {
        LIS: {
          origin: "GRU",
          destination: "LIS",
          airline: "TP",
          departure_at: "2026-11-04T18:05:00-03:00",
          return_at: "",
          price: 3198,
          flight_number: 748,
          transfers: 0
        }
      }
    });

    const deals = await createFlightProvider(env).cityDirections("GRU", 3);

    expect(calls[0]!.url).toBe("https://tp.local/v1/city-directions?origin=GRU&currency=usd");
    expect((calls[0]!.init!.headers as Record<string, string>)["x-access-token"]).toBe("tok");
    expect(deals[0]!.currency).toBe("usd");
    expect(deals[0]!.deepLink).toBe("https://voo.local/GRU-LIS?p=3&m=555");
  });
});

describe("createGeoProvider", () => {
  it("monta o provider de geo", () => {
    expect(createGeoProvider(env)).toBeInstanceOf(TravelpayoutsGeoProvider);
  });

  it("leva base url e token da env para o dump de aeroportos", async () => {
    const calls = stubFetch([
      { code: "GRU", name: "Guarulhos", country_code: "BR", flightable: true }
    ]);

    const airport = await createGeoProvider(env).airport("GRU");

    expect(calls[0]!.url).toBe("https://tp.local/data/en/airports.json");
    expect((calls[0]!.init!.headers as Record<string, string>)["x-access-token"]).toBe("tok");
    expect(airport!.name).toBe("Guarulhos");
  });

  it("converte GEO_DUMP_TTL_SECONDS para milissegundos", async () => {
    const calls = stubFetch([
      { code: "GRU", name: "Guarulhos", country_code: "BR", flightable: true }
    ]);
    // 1 s vira 1000 ms. Se a conversão fosse divisão (0,001 ms), o cache já teria
    // vencido na segunda chamada e haveria dois fetches.
    const geo = createGeoProvider({ ...env, GEO_DUMP_TTL_SECONDS: 1 });

    await geo.airports();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await geo.airports();

    expect(calls).toHaveLength(1);
  });
});

describe("createPlacesProvider", () => {
  it("monta o provider do Google Places com a chave da env", async () => {
    // O provider captura o fetch no construtor — por isso o stub vem antes.
    const calls = stubFetch({ places: [] });
    const provider = createPlacesProvider(env);
    expect(isPlacesProvider(provider)).toBe(true);

    await provider.textSearch({ query: "museus em Lisboa" });

    const sent = `${calls[0]!.url} ${JSON.stringify(calls[0]!.init ?? {})}`;
    expect(sent).toContain("gkey");
  });
});

describe("createHotelProvider", () => {
  const search = {
    cityCode: "LIS",
    countryCode: "PT",
    cityName: "Lisbon",
    latitude: 38.72,
    longitude: -9.13,
    checkIn: "2026-11-10",
    checkOut: "2026-11-15",
    adults: 2
  };

  it("monta a LiteAPI e leva base url, chave, moeda, nacionalidade e raio da env", async () => {
    const calls = stubFetch({ data: [] });
    await createHotelProvider({
      ...env,
      LITEAPI_BASE_URL: "https://lite.local",
      LITEAPI_KEY: "sand_x",
      LITEAPI_CURRENCY: "EUR",
      LITEAPI_GUEST_NATIONALITY: "PT",
      HOTEL_SEARCH_RADIUS_METERS: 3000
    } as Env).search(search);

    expect(calls[0]!.url).toBe(
      "https://lite.local/data/hotels?countryCode=PT&latitude=38.72&longitude=-9.13&radius=3000&limit=25"
    );
    expect((calls[0]!.init!.headers as Record<string, string>)["x-api-key"]).toBe("sand_x");
  });

  it("usa moeda e nacionalidade da env na busca de tarifa", async () => {
    const calls = stubFetch({ data: [{ id: "h1", name: "Hotel", country: "pt", city: "Lisbon" }] });
    await createHotelProvider({ ...env, LITEAPI_CURRENCY: "EUR", LITEAPI_GUEST_NATIONALITY: "PT" } as Env)
      .search(search)
      .catch(() => undefined);

    const rates = calls.find((c) => c.url.includes("min-rates"))!;
    expect(JSON.parse(rates.init!.body as string)).toMatchObject({
      currency: "EUR",
      guestNationality: "PT"
    });
  });
});
