import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  AIRLINES_PATH,
  AIRPORTS_PATH,
  TravelpayoutsGeoProvider,
  WHEREAMI_CALLBACK,
  WHEREAMI_URL,
  CITIES_PATH,
  normalizeAirlines,
  normalizeAirports,
  normalizeCities,
  normalizeWhereami,
  parseCoordinates,
  parseJsonp,
  type TpAirline,
  type TpAirport,
  type TpCity
} from "./travelpayouts-geo-provider.js";
import type { Query, TravelpayoutsHttp } from "./http.js";

function read(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
}

const airportsFixture = JSON.parse(read("airports.json")) as TpAirport[];
const airlinesFixture = JSON.parse(read("airlines.json")) as TpAirline[];
const citiesFixture = JSON.parse(read("cities.json")) as TpCity[];
const whereamiFixture = read("whereami.jsonp");

interface Recorded {
  path: string;
  query: Query;
}

function fakeHttp(text = whereamiFixture): { http: TravelpayoutsHttp; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const http: TravelpayoutsHttp = {
    get: vi.fn(async (path: string, query: Query = {}) => {
      calls.push({ path, query });
      if (path.includes("airlines")) return airlinesFixture;
      if (path.includes("cities")) return citiesFixture;
      return airportsFixture;
    }) as TravelpayoutsHttp["get"],
    getText: vi.fn(async (path: string, query: Query = {}) => {
      calls.push({ path, query });
      return text;
    })
  };
  return { http, calls };
}

describe("parseJsonp", () => {
  it("desembrulha o callback da fixture real do /whereami", () => {
    expect(parseJsonp(whereamiFixture)).toMatchObject({ iata: "XAP", country_code: "BR" });
  });

  it("aceita ponto e vírgula e espaços no fim", () => {
    expect(parseJsonp("  cb({\"a\":1}) ;  ")).toEqual({ a: 1 });
  });

  it("rejeita corpo sem parêntese de abertura ou com fecha antes de abre", () => {
    expect(() => parseJsonp("<html>404</html>")).toThrow("resposta JSONP inesperada");
    expect(() => parseJsonp(")cb(")).toThrow("resposta JSONP inesperada");
    expect(() => parseJsonp("cb()")).toThrow();
  });
});

describe("parseCoordinates", () => {
  it("lê o par lon:lat na ordem do Travelpayouts", () => {
    expect(parseCoordinates("-52.6157:-27.100935")).toEqual({ lat: -27.100935, lon: -52.6157 });
  });

  it("devolve null para ausente, formato errado ou número inválido", () => {
    expect(parseCoordinates(undefined)).toBeNull();
    expect(parseCoordinates("-52.6157")).toBeNull();
    expect(parseCoordinates("1:2:3")).toBeNull();
    expect(parseCoordinates("a:b")).toBeNull();
    expect(parseCoordinates("-52.6157:b")).toBeNull();
  });
});

describe("normalizeWhereami", () => {
  it("normaliza a fixture real", () => {
    expect(normalizeWhereami(parseJsonp(whereamiFixture) as never)).toEqual({
      iata: "XAP",
      name: "Chapeco",
      countryName: "Brazil",
      countryCode: "BR",
      lat: -27.100935,
      lon: -52.6157
    });
  });

  it("devolve null quando o IP não resolveu em IATA ou país", () => {
    expect(normalizeWhereami({})).toBeNull();
    expect(normalizeWhereami({ iata: "GRU" })).toBeNull();
    expect(normalizeWhereami({ country_code: "BR" })).toBeNull();
  });

  it("cai para o iata e o país quando nome e coordenadas faltam", () => {
    expect(normalizeWhereami({ iata: "GRU", country_code: "BR" })).toEqual({
      iata: "GRU",
      name: "GRU",
      countryName: "BR",
      countryCode: "BR",
      lat: null,
      lon: null
    });
  });
});

describe("normalizeAirports", () => {
  it("normaliza a fixture real do dump", () => {
    const airports = normalizeAirports(airportsFixture);
    expect(airports.length).toBe(airportsFixture.length);
    const gru = airports.find((a) => a.iata === "GRU")!;
    expect(gru.cityCode).toBe("SAO");
    expect(gru.countryCode).toBe("BR");
    expect(gru.flightable).toBe(true);
    expect(typeof gru.lat).toBe("number");
  });

  it("aceita item sem cidade, fuso, coordenadas nem flightable", () => {
    expect(
      normalizeAirports([{ code: "ZZZ", name: "Nowhere", country_code: "BR" }])[0]
    ).toEqual({
      iata: "ZZZ",
      name: "Nowhere",
      cityCode: null,
      countryCode: "BR",
      timeZone: null,
      lat: null,
      lon: null,
      flightable: false
    });
  });
});

describe("normalizeAirlines", () => {
  it("normaliza a fixture real do dump", () => {
    const airlines = normalizeAirlines(airlinesFixture);
    expect(airlines.length).toBe(airlinesFixture.length);
    expect(airlines.find((a) => a.code === "JJ")!.name).toContain("LATAM");
  });

  it("assume não-lowcost quando o campo não vem", () => {
    expect(normalizeAirlines([{ code: "ZZ", name: "Z Air" }])[0]!.isLowcost).toBe(false);
  });
});

describe("normalizeCities", () => {
  it("normaliza a fixture real do dump de cidades", () => {
    const cities = normalizeCities(citiesFixture);
    expect(cities.length).toBe(citiesFixture.length);
    const lis = cities.find((c) => c.iata === "LIS")!;
    expect(lis.name).toBe("Lisbon");
    expect(lis.countryCode).toBe("PT");
    expect(lis.lat).toBeCloseTo(38.72, 1);
    expect(lis.lon).toBeCloseTo(-9.14, 1);
  });

  it("aceita cidade sem coordenada", () => {
    expect(
      normalizeCities([{ code: "ZZZ", name: "Nowhere", country_code: "BR" }])[0]
    ).toEqual({ iata: "ZZZ", name: "Nowhere", countryCode: "BR", lat: null, lon: null });
  });
});

describe("TravelpayoutsGeoProvider", () => {
  function provider(http: TravelpayoutsHttp, now?: () => number): TravelpayoutsGeoProvider {
    return new TravelpayoutsGeoProvider({ token: "tok", http, now });
  }

  it("bate no /whereami público, que é outro host e exige o callback useriata", () => {
    expect(WHEREAMI_URL).toBe("https://www.travelpayouts.com/whereami");
    expect(WHEREAMI_CALLBACK).toBe("useriata");
  });

  it("whereami manda ip, locale e callback e devolve a localização", async () => {
    const { http, calls } = fakeHttp();
    await expect(provider(http).whereami("191.240.129.27")).resolves.toMatchObject({
      iata: "XAP"
    });
    expect(calls[0]!.path).toBe(WHEREAMI_URL);
    expect(calls[0]!.query).toEqual({
      ip: "191.240.129.27",
      locale: "br",
      callback: WHEREAMI_CALLBACK
    });
  });

  it("whereami aceita outro locale", async () => {
    const { http, calls } = fakeHttp();
    await provider(http).whereami("1.2.3.4", "en");
    expect(calls[0]!.query.locale).toBe("en");
  });

  it("whereami devolve null quando o IP não resolve", async () => {
    const { http } = fakeHttp("useriata({})");
    await expect(provider(http).whereami("10.0.0.1")).resolves.toBeNull();
  });

  it("busca os dumps no locale configurado", async () => {
    const { http, calls } = fakeHttp();
    const geo = new TravelpayoutsGeoProvider({ token: "t", http, locale: "pt" });
    await geo.airports();
    await geo.airlines();
    expect(calls.map((c) => c.path)).toEqual(["/data/pt/airports.json", "/data/pt/airlines.json"]);
  });

  it("usa en por padrão e cacheia os dumps entre chamadas", async () => {
    const { http, calls } = fakeHttp();
    const geo = provider(http, () => 0);
    await geo.airports();
    await geo.airports();
    await geo.airlines();
    await geo.airlines();
    expect(calls.map((c) => c.path)).toEqual([
      AIRPORTS_PATH.replace("{locale}", "en"),
      AIRLINES_PATH.replace("{locale}", "en")
    ]);
  });

  it("cacheia mesmo sem relógio injetado — o default é Date.now", async () => {
    const { http, calls } = fakeHttp();
    const geo = new TravelpayoutsGeoProvider({ token: "t", http });
    await geo.airports();
    await geo.airports();
    expect(calls).toHaveLength(1);
  });

  it("rebusca no instante exato em que o TTL vence", async () => {
    const { http, calls } = fakeHttp();
    let clock = 0;
    const geo = new TravelpayoutsGeoProvider({
      token: "t",
      http,
      dumpTtlMs: 1000,
      now: () => clock
    });
    await geo.airports();
    clock = 1000;
    await geo.airports();
    expect(calls).toHaveLength(2);
  });

  it("rebusca os dumps depois do TTL", async () => {
    const { http, calls } = fakeHttp();
    let clock = 0;
    const geo = new TravelpayoutsGeoProvider({
      token: "t",
      http,
      dumpTtlMs: 1000,
      now: () => clock
    });
    await geo.airports();
    await geo.airlines();
    clock = 5000;
    await geo.airports();
    await geo.airlines();
    expect(calls).toHaveLength(4);
  });

  it("airport e airline resolvem por código, ignorando caixa", async () => {
    const { http } = fakeHttp();
    const geo = provider(http);
    expect((await geo.airport("gru"))!.name).toContain("Guarulhos");
    expect((await geo.airline("jj"))!.name).toContain("LATAM");
  });

  it("airport e airline devolvem null para código desconhecido", async () => {
    const { http } = fakeHttp();
    const geo = provider(http);
    await expect(geo.airport("ZZZ")).resolves.toBeNull();
    await expect(geo.airline("ZZ")).resolves.toBeNull();
  });

  it("searchAirports casa por prefixo de IATA e por trecho do nome", async () => {
    const { http } = fakeHttp();
    const geo = provider(http);
    expect((await geo.searchAirports("gru")).map((a) => a.iata)).toEqual(["GRU"]);
    expect((await geo.searchAirports("guarulhos")).map((a) => a.iata)).toEqual(["GRU"]);
    // Prefixo, não sufixo: "bk" acha BKK; "kk" (fim do código) não — e o nome
    // do BKK ("Suvarnabhumi") não contém nenhum dos dois, então isola o casamento.
    expect((await geo.searchAirports("bk")).map((a) => a.iata)).toContain("BKK");
    expect((await geo.searchAirports("kk")).map((a) => a.iata)).not.toContain("BKK");
  });

  it("searchAirports ignora espaços em volta do termo", async () => {
    const { http } = fakeHttp();
    expect((await provider(http).searchAirports("  gru  ")).map((a) => a.iata)).toEqual(["GRU"]);
  });

  it("searchAirports respeita o limite e devolve vazio para termo em branco", async () => {
    const { http } = fakeHttp();
    const geo = provider(http);
    expect(await geo.searchAirports("   ")).toEqual([]);
    expect((await geo.searchAirports("a", 2)).length).toBeLessThanOrEqual(2);
  });

  it("monta o http real quando nenhum é injetado", () => {
    expect(() => new TravelpayoutsGeoProvider({ token: "t" })).not.toThrow();
  });

  it("city resolve o IATA de cidade direto, ignorando caixa", async () => {
    const { http, calls } = fakeHttp();
    const city = await provider(http).city("lis");

    expect(city!.name).toBe("Lisbon");
    expect(calls.map((c) => c.path)).toEqual([CITIES_PATH.replace("{locale}", "en")]);
  });

  it("city de um IATA de aeroporto resolve pelo city_code — GRU vira São Paulo", async () => {
    const { http } = fakeHttp();
    const city = await provider(http).city("GRU");

    expect(city!.iata).toBe("SAO");
    expect(city!.countryCode).toBe("BR");
  });

  it("city devolve null para código desconhecido e para aeroporto sem cidade no dump", async () => {
    const { http } = fakeHttp();
    const geo = provider(http);
    await expect(geo.city("ZZZ")).resolves.toBeNull();
    // XAP está no dump de aeroportos, mas a cidade dele não está no de cidades.
    await expect(geo.city("XAP")).resolves.toBeNull();
  });

  it("city devolve null quando o aeroporto não tem city_code", async () => {
    const semCidade: TravelpayoutsGeoProvider = new TravelpayoutsGeoProvider({
      token: "t",
      http: {
        get: (async (path: string) =>
          path.includes("cities")
            ? []
            : [{ code: "ZZZ", name: "Solto", country_code: "BR" }]) as never,
        getText: async () => ""
      }
    });
    await expect(semCidade.city("ZZZ")).resolves.toBeNull();
  });

  it("cacheia o dump de cidades entre chamadas", async () => {
    const { http, calls } = fakeHttp();
    const geo = provider(http, () => 0);
    await geo.cities();
    await geo.cities();
    expect(calls).toHaveLength(1);
  });

  it("rebusca o dump de cidades depois do TTL", async () => {
    const { http, calls } = fakeHttp();
    let clock = 0;
    const geo = new TravelpayoutsGeoProvider({ token: "t", http, dumpTtlMs: 1000, now: () => clock });
    await geo.cities();
    clock = 5000;
    await geo.cities();
    expect(calls).toHaveLength(2);
  });
});
