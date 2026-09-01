import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { flightOfferSchema } from "@farol/shared";
import { parseIsoDurationMinutes, normalizeFlight } from "./normalize-flight.js";
import { fillTemplate } from "./deep-link.js";

const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/flight-offers.json", import.meta.url)), "utf8")
) as unknown;

const TEMPLATE =
  "https://parceiro.example.com/voos?o={origin}&d={destination}&ida={departDate}&volta={returnDate}";

describe("parseIsoDurationMinutes", () => {
  it("converte horas e minutos", () => {
    expect(parseIsoDurationMinutes("PT12H30M")).toBe(750);
  });
  it("converte só horas", () => {
    expect(parseIsoDurationMinutes("PT10H")).toBe(600);
  });
  it("converte só minutos", () => {
    expect(parseIsoDurationMinutes("PT45M")).toBe(45);
  });
  it("conta dias", () => {
    expect(parseIsoDurationMinutes("P1DT2H30M")).toBe(1590);
  });
  it("devolve 0 para string inválida", () => {
    expect(parseIsoDurationMinutes("12h30")).toBe(0);
  });

  it.each(["PT12H30M ", "xPT12H", "PT12H30", "PTHM", "P", "PT"])(
    "devolve 0 quando a âncora/estrutura não bate: %s",
    (bad) => {
      expect(parseIsoDurationMinutes(bad)).toBe(0);
    }
  );

  it("aceita 'PT' vazio como 0 só se casar o padrão completo", () => {
    // "PT0M" casa e é 0
    expect(parseIsoDurationMinutes("PT0M")).toBe(0);
  });
});

describe("fillTemplate", () => {
  it("substitui os placeholders conhecidos", () => {
    expect(fillTemplate("a={x}&b={y}", { x: "1", y: "2" })).toBe("a=1&b=2");
  });
  it("placeholder sem valor vira string vazia", () => {
    expect(fillTemplate("a={x}&b={y}", { x: "1" })).toBe("a=1&b=");
  });
});

describe("normalizeFlight", () => {
  const offers = normalizeFlight(fixture, TEMPLATE);

  it("devolve uma oferta por item da resposta", () => {
    expect(offers).toHaveLength(4);
  });

  it("cada oferta bate o flightOfferSchema", () => {
    for (const offer of offers) {
      expect(() => flightOfferSchema.parse(offer)).not.toThrow();
    }
  });

  it("voo direto tem stops 0; voo com conexão tem stops 1", () => {
    expect(offers.find((o) => o.id === "1")!.stops).toBe(0);
    expect(offers.find((o) => o.id === "2")!.stops).toBe(1);
  });

  it("usa grandTotal quando presente, senão total", () => {
    expect(offers.find((o) => o.id === "2")!.price).toBe(3980);
    expect(offers.find((o) => o.id === "1")!.price).toBe(4210.55);
    expect(offers.find((o) => o.id === "4")!.price).toBe(5555); // sem grandTotal → usa total
  });

  it("carrier vem do primeiro segmento", () => {
    expect(offers.find((o) => o.id === "1")!.carrier).toBe("TP");
    expect(offers.find((o) => o.id === "2")!.carrier).toBe("AF");
  });

  it("durationMinutes vem da duração da ida", () => {
    expect(offers.find((o) => o.id === "1")!.durationMinutes).toBe(615);
  });

  it("returnAt é null para one-way e string para ida-e-volta", () => {
    expect(offers.find((o) => o.id === "1")!.returnAt).toBeNull();
    expect(offers.find((o) => o.id === "3")!.returnAt).toBe("2026-09-20T10:45:00");
  });

  it("deepLink preenche origem, destino e datas", () => {
    const oneWay = offers.find((o) => o.id === "1")!;
    expect(oneWay.deepLink).toBe(
      "https://parceiro.example.com/voos?o=GRU&d=LIS&ida=2026-09-10&volta="
    );
    const roundTrip = offers.find((o) => o.id === "3")!;
    expect(roundTrip.deepLink).toBe(
      "https://parceiro.example.com/voos?o=GRU&d=LIS&ida=2026-09-10&volta=2026-09-20"
    );
  });

  it("resposta sem data devolve lista vazia", () => {
    expect(normalizeFlight({}, TEMPLATE)).toEqual([]);
  });
});
