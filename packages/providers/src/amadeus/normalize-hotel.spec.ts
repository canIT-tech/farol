import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hotelOfferSchema } from "@farol/shared";
import { nightsBetween, normalizeHotel, toRating } from "./normalize-hotel.js";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as unknown;
}

const list = loadFixture("hotel-list.json");
const offers = loadFixture("hotel-offers.json");
const TEMPLATE = "https://parceiro.example.com/hoteis?c={cityCode}&in={checkIn}&out={checkOut}";

describe("toRating", () => {
  it("aceita os limites 1 e 5", () => {
    expect(toRating("1")).toBe(1);
    expect(toRating("5")).toBe(5);
  });
  it("rejeita fora da faixa (0, 6) → null", () => {
    expect(toRating("0")).toBeNull();
    expect(toRating("6")).toBeNull();
  });
  it("ausente → null", () => {
    expect(toRating(undefined)).toBeNull();
  });
  it("valor não-numérico → null", () => {
    expect(toRating("ótimo")).toBeNull();
  });
});

describe("nightsBetween", () => {
  it("conta as diárias entre check-in e check-out", () => {
    expect(nightsBetween("2026-09-10", "2026-09-17")).toBe(7);
  });
  it("é 1 para uma diária", () => {
    expect(nightsBetween("2026-09-10", "2026-09-11")).toBe(1);
  });
});

describe("normalizeHotel", () => {
  const result = normalizeHotel(list, offers, TEMPLATE);

  it("gera uma oferta por hotel com oferta disponível", () => {
    expect(result.map((h) => h.id).sort()).toEqual(["OFFER-AC-1", "OFFER-IN-1", "OFFER-MC-1"]);
  });

  it("cada oferta bate o hotelOfferSchema", () => {
    for (const hotel of result) {
      expect(() => hotelOfferSchema.parse(hotel)).not.toThrow();
    }
  });

  it("pricePerNight = priceTotal / noites, arredondado a 2 casas", () => {
    const marriott = result.find((h) => h.id === "OFFER-MC-1")!;
    expect(marriott.priceTotal).toBe(7000);
    expect(marriott.pricePerNight).toBe(1000); // 7000 / 7
  });

  it("rating 1..5 vira número; fora da faixa vira null; ausente vira null", () => {
    expect(result.find((h) => h.id === "OFFER-MC-1")!.rating).toBe(5);
    expect(result.find((h) => h.id === "OFFER-AC-1")!.rating).toBeNull(); // sem rating
    expect(result.find((h) => h.id === "OFFER-IN-1")!.rating).toBeNull(); // "7" fora da faixa
  });

  it("region vem da 1a linha de endereço da lista, senão null", () => {
    expect(result.find((h) => h.id === "OFFER-MC-1")!.region).toBe("Avenida dos Combatentes 45");
    expect(result.find((h) => h.id === "OFFER-AC-1")!.region).toBeNull();
  });

  it("entrada da lista sem address não quebra (region null)", () => {
    const listNoAddress = { data: [{ hotelId: "MCLISABC" }] };
    const out = normalizeHotel(listNoAddress, offers, TEMPLATE);
    expect(out.find((h) => h.id === "OFFER-MC-1")!.region).toBeNull();
  });

  it("deepLink preenche cidade e datas", () => {
    expect(result.find((h) => h.id === "OFFER-AC-1")!.deepLink).toBe(
      "https://parceiro.example.com/hoteis?c=LIS&in=2026-09-10&out=2026-09-17"
    );
  });

  it("respostas vazias devolvem lista vazia", () => {
    expect(normalizeHotel({}, {}, TEMPLATE)).toEqual([]);
  });

  it("ignora item sem ofertas", () => {
    const noOffers = { data: [{ hotel: { hotelId: "X", name: "X", cityCode: "LIS" }, offers: [] }] };
    expect(normalizeHotel({ data: [] }, noOffers, TEMPLATE)).toEqual([]);
  });

  it("ignora item cujo check-out não é depois do check-in", () => {
    const sameDay = {
      data: [
        {
          hotel: { hotelId: "X", name: "X", cityCode: "LIS" },
          offers: [
            {
              id: "X-1",
              checkInDate: "2026-09-10",
              checkOutDate: "2026-09-10",
              price: { currency: "BRL", total: "100.00" }
            }
          ]
        }
      ]
    };
    expect(normalizeHotel({ data: [] }, sameDay, TEMPLATE)).toEqual([]);
  });
});
