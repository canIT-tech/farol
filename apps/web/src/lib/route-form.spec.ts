import { describe, it, expect } from "vitest";
import type { RouteDeal } from "@farol/shared";
import {
  cheapestDeal,
  emptyRouteForm,
  monthLabel,
  toMonthsInput,
  toOffersInput
} from "./route-form";

const cheio = {
  ...emptyRouteForm(),
  origin: "FLN",
  destination: "SYD",
  depart: "2027-02-11",
  return: "2027-02-25"
};

describe("emptyRouteForm", () => {
  it("começa em ida e volta com um adulto", () => {
    const state = emptyRouteForm();
    expect(state.tripType).toBe("round-trip");
    expect(state.adults).toBe(1);
    expect(state.children).toBe(0);
  });
});

describe("toMonthsInput", () => {
  it("basta a rota — não precisa de data", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FLN", destination: "SYD" })).toEqual({
      origin: "FLN",
      destination: "SYD",
      adults: 1,
      children: 0
    });
  });

  it("é nulo sem destino", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FLN" })).toBeNull();
  });

  it("é nulo sem origem", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), destination: "SYD" })).toBeNull();
  });

  it("é nulo com IATA incompleto", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FL", destination: "SYD" })).toBeNull();
  });

  it("é nulo com IATA que não é letra", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FL1", destination: "SYD" })).toBeNull();
  });

  // Quem digita "fln" quer FLN. Normalizar aqui evita um 400 da api por causa
  // de caixa.
  it("normaliza para maiúsculas e ignora espaço", () => {
    const input = toMonthsInput({ ...emptyRouteForm(), origin: " fln ", destination: "syd" })!;
    expect(input.origin).toBe("FLN");
    expect(input.destination).toBe("SYD");
  });

  it("leva os passageiros", () => {
    const input = toMonthsInput({ ...cheio, adults: 2, children: 3 })!;
    expect(input.adults).toBe(2);
    expect(input.children).toBe(3);
  });
});

describe("toOffersInput", () => {
  it("ida e volta leva as duas datas", () => {
    expect(toOffersInput(cheio)).toEqual({
      origin: "FLN",
      destination: "SYD",
      adults: 1,
      children: 0,
      depart: "2027-02-11",
      return: "2027-02-25"
    });
  });

  // O campo de volta continua preenchido quando a pessoa troca para ida só —
  // mandar aquela data assim mesmo compraria uma passagem que ela não pediu.
  it("ida só omite a volta mesmo com o campo preenchido", () => {
    expect(toOffersInput({ ...cheio, tripType: "one-way" })!.return).toBeUndefined();
  });

  it("é nulo sem data de ida", () => {
    expect(toOffersInput({ ...cheio, depart: "" })).toBeNull();
  });

  it("é nulo em ida e volta sem data de volta", () => {
    expect(toOffersInput({ ...cheio, return: "" })).toBeNull();
  });

  it("é nulo com rota incompleta", () => {
    expect(toOffersInput({ ...cheio, destination: "" })).toBeNull();
  });
});

describe("monthLabel", () => {
  it("escreve o mês por extenso", () => {
    expect(monthLabel("2027-02")).toBe("fevereiro de 2027");
  });

  // A chave do RouteDeal é o mês no /prices/monthly e o IATA do destino no
  // /city-directions. Passar cru é melhor que virar "mês NaN".
  it("devolve a chave crua quando não é um mês", () => {
    expect(monthLabel("SYD")).toBe("SYD");
  });

  it("devolve a chave crua quando o mês não existe", () => {
    expect(monthLabel("2027-13")).toBe("2027-13");
  });
});

describe("cheapestDeal", () => {
  const deal = (key: string, price: number) => ({ key, price }) as RouteDeal;

  it("acha o menor preço", () => {
    expect(cheapestDeal([deal("2027-01", 9000), deal("2027-02", 6420)])!.key).toBe("2027-02");
  });

  it("mantém o primeiro em caso de empate", () => {
    expect(cheapestDeal([deal("2027-01", 6420), deal("2027-02", 6420)])!.key).toBe("2027-01");
  });

  it("é nulo na lista vazia", () => {
    expect(cheapestDeal([])).toBeNull();
  });
});
