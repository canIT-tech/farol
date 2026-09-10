import { describe, it, expect } from "vitest";
import {
  flightSearchParamsSchema,
  flightOfferSchema,
  flightPriceContextSchema,
  flightSegmentSchema
} from "./flights.js";

const baseParams = {
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: "2026-09-10",
  adults: 2,
  children: 0
};

const baseOffer = {
  id: "off-1",
  price: 3200.5,
  currency: "BRL",
  carrier: "TP",
  carrierName: "TAP Air Portugal",
  originIata: "GRU",
  originName: "Sao Paulo-Guarulhos International Airport",
  destinationIata: "LIS",
  destinationName: "Lisbon Airport",
  stops: 1,
  departAt: "2026-09-10T22:10:00",
  arriveAt: "2026-09-11T12:40:00",
  returnAt: null,
  durationMinutes: 750,
  deepLink: "https://parceiro.example.com/voos?o=GRU&d=LIS"
};

describe("flightSearchParamsSchema", () => {
  it("aceita parâmetros válidos sem returnDate/maxStops", () => {
    const parsed = flightSearchParamsSchema.parse(baseParams);
    expect(parsed.returnDate).toBeUndefined();
    expect(parsed.maxStops).toBeUndefined();
  });

  it("aceita returnDate e maxStops opcionais", () => {
    const parsed = flightSearchParamsSchema.parse({
      ...baseParams,
      returnDate: "2026-09-20",
      maxStops: 0
    });
    expect(parsed.returnDate).toBe("2026-09-20");
    expect(parsed.maxStops).toBe(0);
  });

  it("rejeita iata que não tem 3 letras", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, originIata: "GR" })).toThrow();
    expect(() =>
      flightSearchParamsSchema.parse({ ...baseParams, destinationIata: "LISB" })
    ).toThrow();
  });

  it("rejeita departDate fora do formato YYYY-MM-DD", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, departDate: "10/09/2026" })).toThrow();
  });

  it("exige ao menos 1 adulto e children >= 0", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, adults: 0 })).toThrow();
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, children: -1 })).toThrow();
  });

  it("rejeita maxStops negativo ou fracionário", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, maxStops: -1 })).toThrow();
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, maxStops: 1.5 })).toThrow();
  });
});

describe("flightOfferSchema", () => {
  it("aceita uma oferta completa", () => {
    expect(flightOfferSchema.parse(baseOffer).id).toBe("off-1");
  });

  it("aceita returnAt string quando é ida-e-volta", () => {
    const parsed = flightOfferSchema.parse({ ...baseOffer, returnAt: "2026-09-20T08:00:00" });
    expect(parsed.returnAt).toBe("2026-09-20T08:00:00");
  });

  it("rejeita stops negativo", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, stops: -1 })).toThrow();
  });

  it("aceita stops zero (voo direto)", () => {
    expect(flightOfferSchema.parse({ ...baseOffer, stops: 0 }).stops).toBe(0);
  });

  it("rejeita price não-positivo", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, price: 0 })).toThrow();
  });

  it("aceita durationMinutes zero — o cache do Travelpayouts nem sempre traz duração", () => {
    expect(flightOfferSchema.parse({ ...baseOffer, durationMinutes: 0 }).durationMinutes).toBe(0);
  });

  it("rejeita durationMinutes negativo ou fracionário", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, durationMinutes: -1 })).toThrow();
    expect(() => flightOfferSchema.parse({ ...baseOffer, durationMinutes: 12.5 })).toThrow();
  });

  it("rejeita deepLink que não é URL", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, deepLink: "nao-e-url" })).toThrow();
  });

  it("rejeita carrier vazio", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, carrier: "" })).toThrow();
  });

  it("assume nulo nos nomes de companhia e aeroporto quando não vêm", () => {
    const semNomes: Partial<typeof baseOffer> = { ...baseOffer };
    delete semNomes.carrierName;
    delete semNomes.originName;
    delete semNomes.destinationName;
    const parsed = flightOfferSchema.parse(semNomes);
    expect(parsed.carrierName).toBeNull();
    expect(parsed.originName).toBeNull();
    expect(parsed.destinationName).toBeNull();
  });

  it("exige originIata e destinationIata com 3 letras", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, originIata: "GR" })).toThrow();
    expect(() => flightOfferSchema.parse({ ...baseOffer, destinationIata: "LISB" })).toThrow();
    const semOrigem: Partial<typeof baseOffer> = { ...baseOffer };
    delete semOrigem.originIata;
    expect(() => flightOfferSchema.parse(semOrigem)).toThrow();
  });
});

describe("flightPriceContextSchema", () => {
  const base = {
    cheapest: 1997,
    typical: 1954,
    delta: -44,
    bandLow: 1900,
    bandHigh: 2100,
    currency: "BRL",
    history: [{ at: "2026-07-05", price: 2134 }]
  };

  it("aceita um contexto completo", () => {
    expect(flightPriceContextSchema.parse(base)).toEqual(base);
  });

  // Estar abaixo do típico é a informação mais útil que o contexto carrega —
  // um schema que exigisse positivo apagaria justamente o "compre agora".
  it("aceita delta negativo", () => {
    expect(flightPriceContextSchema.parse({ ...base, delta: -300 }).delta).toBe(-300);
  });

  it("aceita histórico vazio", () => {
    expect(flightPriceContextSchema.parse({ ...base, history: [] }).history).toEqual([]);
  });

  it("recusa preço não positivo", () => {
    expect(() => flightPriceContextSchema.parse({ ...base, cheapest: 0 })).toThrow();
  });

  it("recusa ponto de histórico sem data", () => {
    expect(() =>
      flightPriceContextSchema.parse({ ...base, history: [{ at: "", price: 10 }] })
    ).toThrow();
  });
});

describe("flightSegmentSchema", () => {
  const segment = {
    fromIata: "FLN",
    fromName: "Florianópolis",
    toIata: "SCL",
    toName: "Santiago",
    departAt: "2027-02-11T06:15:00",
    arriveAt: "2027-02-11T10:40:00",
    durationMinutes: 265,
    flightNumber: "LA755"
  };

  it("aceita um trecho completo", () => {
    expect(flightSegmentSchema.parse(segment)).toEqual(segment);
  });

  // O Travelpayouts não nomeia aeroporto nem numera voo. Sem os defaults, um
  // trecho vindo de lá reprovaria no parse.
  it("deixa nome e número de voo nulos quando o provider não informa", () => {
    const parsed = flightSegmentSchema.parse({
      fromIata: "FLN",
      toIata: "SCL",
      departAt: "2027-02-11T06:15:00",
      arriveAt: "2027-02-11T10:40:00",
      durationMinutes: 265
    });
    expect(parsed.fromName).toBeNull();
    expect(parsed.toName).toBeNull();
    expect(parsed.flightNumber).toBeNull();
  });

  it("recusa IATA que não tem três letras", () => {
    expect(() => flightSegmentSchema.parse({ ...segment, fromIata: "FL" })).toThrow();
  });

  it("recusa duração negativa", () => {
    expect(() => flightSegmentSchema.parse({ ...segment, durationMinutes: -1 })).toThrow();
  });
});

describe("flightOfferSchema com segments", () => {
  it("assume lista vazia quando o provider não informa o caminho", () => {
    expect(flightOfferSchema.parse(baseOffer).segments).toEqual([]);
  });

  it("guarda os trechos quando o provider informa", () => {
    const parsed = flightOfferSchema.parse({
      ...baseOffer,
      segments: [
        {
          fromIata: "GRU",
          toIata: "CDG",
          departAt: "2026-09-10T22:10:00",
          arriveAt: "2026-09-11T09:50:00",
          durationMinutes: 680
        },
        {
          fromIata: "CDG",
          toIata: "LIS",
          departAt: "2026-09-11T11:55:00",
          arriveAt: "2026-09-11T12:40:00",
          durationMinutes: 135
        }
      ]
    });
    expect(parsed.segments.map((s) => s.toIata)).toEqual(["CDG", "LIS"]);
  });
});
