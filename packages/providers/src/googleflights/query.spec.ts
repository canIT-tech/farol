import { describe, expect, it } from "vitest";
import { searchUrl, toTfsQuery } from "./query.js";

const params = {
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: "2026-11-15",
  adults: 1,
  children: 0
};

describe("toTfsQuery", () => {
  it("faz uma perna quando não há volta", () => {
    expect(toTfsQuery(params).legs).toEqual([
      { date: "2026-11-15", fromIata: "GRU", toIata: "LIS" }
    ]);
  });

  it("faz a perna de volta invertendo a rota", () => {
    expect(toTfsQuery({ ...params, returnDate: "2026-11-25" }).legs).toEqual([
      { date: "2026-11-15", fromIata: "GRU", toIata: "LIS" },
      { date: "2026-11-25", fromIata: "LIS", toIata: "GRU" }
    ]);
  });

  it("repassa passageiros e limite de escalas", () => {
    const query = toTfsQuery({ ...params, adults: 2, children: 1, maxStops: 0 });
    expect(query.adults).toBe(2);
    expect(query.children).toBe(1);
    expect(query.maxStops).toBe(0);
  });
});

describe("searchUrl", () => {
  const url = (over = {}) =>
    new URL(searchUrl("https://www.google.com/travel/flights", { ...params, ...over }, { locale: "pt-BR", currency: "BRL" }));

  it("põe o tfs, o idioma e a moeda na query", () => {
    const u = url();
    expect(u.searchParams.get("hl")).toBe("pt-BR");
    expect(u.searchParams.get("curr")).toBe("BRL");
    expect(u.searchParams.get("tfs")).toBe("GhoSCjIwMjYtMTEtMTVqBRIDR1JVcgUSA0xJU0ABSAGYAQI=");
  });

  // O tfs é base64 padrão, com "+", "/" e "=". Sem escape, o "+" chega ao
  // Google como espaço e o "=" como separador — a busca vira outra. Um teto de
  // 5500 produz um "/" no blob, então este caso exercita o escape de verdade.
  it("escapa o tfs na query string", () => {
    const bruto = searchUrl(
      "https://www.google.com/travel/flights",
      { ...params, maxPrice: 5500 },
      { locale: "pt-BR", currency: "BRL" }
    );
    const tfs = "GhoSCjIwMjYtMTEtMTVqBRIDR1JVcgUSA0xJU0ABSAFg/CqYAQI=";
    expect(tfs).toMatch(/[+/=]/);
    expect(bruto).not.toContain(tfs);
    expect(new URL(bruto).searchParams.get("tfs")).toBe(tfs);
  });

  it("respeita uma base diferente", () => {
    expect(searchUrl("https://exemplo.test/f", params, { locale: "en", currency: "USD" })).toMatch(
      /^https:\/\/exemplo\.test\/f\?/
    );
  });
});
