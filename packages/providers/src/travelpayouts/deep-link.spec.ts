import { describe, it, expect } from "vitest";
import {
  AVIASALES_BASE_URL,
  AVIASALES_SEARCH_TEMPLATE,
  aviasalesLink,
  ddmm,
  withMarker
} from "./deep-link.js";
import { fillTemplate } from "../template.js";

describe("ddmm", () => {
  it("converte YYYY-MM-DD em DDMM", () => {
    expect(ddmm("2026-10-22")).toBe("2210");
    expect(ddmm("2027-01-05")).toBe("0501");
  });
});

describe("withMarker", () => {
  it("abre a query quando a URL não tem nenhuma", () => {
    expect(withMarker("https://x.example.com/a", "123")).toBe(
      "https://x.example.com/a?marker=123"
    );
  });

  it("acrescenta à query existente", () => {
    expect(withMarker("https://x.example.com/a?t=1", "123")).toBe(
      "https://x.example.com/a?t=1&marker=123"
    );
  });

  it("escapa o marker", () => {
    expect(withMarker("https://x.example.com", "a b")).toBe("https://x.example.com?marker=a%20b");
  });
});

describe("aviasalesLink", () => {
  it("prefixa o host do Aviasales e anexa o marker ao caminho relativo", () => {
    expect(aviasalesLink("/search/SAO0205RIO1?t=abc", "555")).toBe(
      `${AVIASALES_BASE_URL}/search/SAO0205RIO1?t=abc&marker=555`
    );
  });
});

describe("AVIASALES_SEARCH_TEMPLATE", () => {
  it("monta a busca de ida e volta com o marker", () => {
    expect(
      fillTemplate(AVIASALES_SEARCH_TEMPLATE, {
        origin: "GRU",
        destination: "LIS",
        departDdmm: "1009",
        returnDdmm: "2009",
        passengers: "2",
        marker: "555"
      })
    ).toBe(`${AVIASALES_BASE_URL}/search/GRU1009LIS20092?marker=555`);
  });

  it("monta a busca só de ida quando não há volta", () => {
    expect(
      fillTemplate(AVIASALES_SEARCH_TEMPLATE, {
        origin: "GRU",
        destination: "LIS",
        departDdmm: "1009",
        returnDdmm: "",
        passengers: "1",
        marker: "555"
      })
    ).toBe(`${AVIASALES_BASE_URL}/search/GRU1009LIS1?marker=555`);
  });
});
