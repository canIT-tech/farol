import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hotelOfferSchema } from "@farol/shared";
import {
  buildHotelDeepLink,
  nightsBetween,
  normalizeHotels,
  toFiveScale,
  type LiteApiHotelsResponse,
  type LiteApiMinRatesResponse
} from "./normalize-hotel.js";

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as T;
}

const TEMPLATE =
  "https://parceiro.example.com/hoteis?cidade={cityName}&in={checkIn}&out={checkOut}&h={hotelName}&p={adults}";

const ctx = {
  template: TEMPLATE,
  cityCode: "LIS",
  cityName: "Lisbon",
  checkIn: "2026-11-10",
  checkOut: "2026-11-15",
  adults: 2
};

describe("nightsBetween", () => {
  it("conta as noites entre check-in e check-out", () => {
    expect(nightsBetween("2026-11-10", "2026-11-15")).toBe(5);
    expect(nightsBetween("2026-11-10", "2026-11-11")).toBe(1);
  });

  it("nunca devolve menos de 1 — dividir por zero viraria preço infinito", () => {
    expect(nightsBetween("2026-11-10", "2026-11-10")).toBe(1);
    expect(nightsBetween("2026-11-15", "2026-11-10")).toBe(1);
  });
});

describe("toFiveScale", () => {
  it("converte a nota de 0..10 da LiteAPI para a estrela de 0..5", () => {
    expect(toFiveScale(9.6)).toBe(4.8);
    expect(toFiveScale(10)).toBe(5);
    expect(toFiveScale(0)).toBe(0);
  });

  it("arredonda para uma casa", () => {
    expect(toFiveScale(8.55)).toBe(4.3);
  });

  it("devolve null quando o hotel não tem nota", () => {
    expect(toFiveScale(undefined)).toBeNull();
  });
});

describe("buildHotelDeepLink", () => {
  it("preenche o template e escapa o nome do hotel", () => {
    expect(buildHotelDeepLink(ctx, "Hotel & Spa")).toBe(
      "https://parceiro.example.com/hoteis?cidade=Lisbon&in=2026-11-10&out=2026-11-15&h=Hotel%20%26%20Spa&p=2"
    );
  });
});

describe("normalizeHotels", () => {
  const hotels = fixture<LiteApiHotelsResponse>("data-hotels.json");
  const rates = fixture<LiteApiMinRatesResponse>("min-rates.json");

  it("junta conteúdo e tarifa da fixture real em ofertas válidas", () => {
    const offers = normalizeHotels(hotels, rates, ctx, "BRL");

    for (const offer of offers) {
      expect(() => hotelOfferSchema.parse(offer)).not.toThrow();
      expect(offer.currency).toBe("BRL");
      expect(offer.deepLink).toContain("in=2026-11-10");
    }
    const lumen = offers.find((o) => o.id === "lp65571137")!;
    expect(lumen.name).toBe("Lumen Hotel & The Lisbon Light Show");
    expect(lumen.stars).toBe(4);
    expect(lumen.rating).toBe(4.8);
    expect(lumen.reviewCount).toBe(3632);
    expect(lumen.photoUrl).toContain("https://");
    expect(lumen.region).toBe("Lisbon");
    expect(lumen.address).toBe("20 Rua Sousa Martins");
  });

  it("descarta o hotel que veio sem tarifa — o cartão promete um preço", () => {
    const pedidos = hotels.data!.length;
    const comTarifa = rates.data!.length;
    expect(pedidos).toBeGreaterThan(comTarifa);

    const offers = normalizeHotels(hotels, rates, ctx, "BRL");
    expect(offers).toHaveLength(comTarifa);
    expect(offers.map((o) => o.id)).not.toContain("lpaf35b");
  });

  it("divide o total pelas noites e ordena pelo preço da diária", () => {
    const offers = normalizeHotels(hotels, rates, ctx, "BRL");
    const perNight = offers.map((o) => o.pricePerNight);
    expect(perNight).toEqual([...perNight].sort((a, b) => a - b));

    const lumen = offers.find((o) => o.id === "lp65571137")!;
    expect(lumen.priceTotal).toBe(4324.75);
    expect(lumen.pricePerNight).toBe(864.95);
  });

  // Pego contra a API real: parte dos hotéis vem com address "" (e não ausente),
  // o que reprovava no `min(1)` do schema e derrubava a busca inteira.
  it("trata campo textual vazio como ausente, não como valor", () => {
    const offer = normalizeHotels(
      {
        data: [
          { id: "h1", name: "Pousada", country: "br", city: "", address: "", main_photo: "" }
        ]
      },
      { data: [{ hotelId: "h1", price: 500 }] },
      ctx,
      "BRL"
    )[0]!;

    expect(offer.address).toBeNull();
    expect(offer.region).toBeNull();
    expect(offer.photoUrl).toBeNull();
  });

  it("aceita hotel sem foto, endereço, estrelas, nota nem coordenada", () => {
    const magro: LiteApiHotelsResponse = {
      data: [{ id: "h1", name: "Pousada", country: "br", city: "" }]
    };
    const offer = normalizeHotels(
      magro,
      { data: [{ hotelId: "h1", price: 500 }] },
      ctx,
      "BRL"
    )[0]!;

    expect(offer.region).toBeNull();
    expect(offer.address).toBeNull();
    expect(offer.stars).toBeNull();
    expect(offer.rating).toBeNull();
    expect(offer.reviewCount).toBeNull();
    expect(offer.photoUrl).toBeNull();
    expect(offer.lat).toBeNull();
    expect(offer.lng).toBeNull();
    expect(offer.pricePerNight).toBe(100);
  });

  it("descarta tarifa zerada ou negativa", () => {
    const magro: LiteApiHotelsResponse = {
      data: [{ id: "h1", name: "Pousada", country: "br", city: "Rio" }]
    };
    expect(normalizeHotels(magro, { data: [{ hotelId: "h1", price: 0 }] }, ctx, "BRL")).toEqual([]);
    expect(normalizeHotels(magro, { data: [{ hotelId: "h1", price: -5 }] }, ctx, "BRL")).toEqual([]);
  });

  it("devolve lista vazia quando não há hotéis nem tarifas", () => {
    expect(normalizeHotels({}, {}, ctx, "BRL")).toEqual([]);
    expect(normalizeHotels({ data: [] }, { data: [] }, ctx, "BRL")).toEqual([]);
  });
});
