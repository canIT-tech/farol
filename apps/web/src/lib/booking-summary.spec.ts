import { describe, it, expect } from "vitest";
import type { TripState } from "@farol/shared";
import {
  bookingSubtitle,
  dateRangeLabel,
  dayPillDate,
  itinerarySubtitle,
  itineraryTitle,
  monthShort
} from "./booking-summary";

const CLOSING = "A reserva é concluída no site do parceiro.";

const trip = {
  id: "t-1",
  userId: "u-1",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: "2026-05-10",
  dateEnd: "2026-05-17",
  durationDays: 7,
  targetMonth: null,
  party: { adults: 2, children: 0 },
  budgetTotal: 12000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-05-01T00:00:00.000Z",
  destinations: [],
  chosenDestination: { iata: "CTG" }
} as unknown as TripState;

describe("dateRangeLabel", () => {
  it("junta os dias quando ida e volta caem no mesmo mês", () => {
    expect(dateRangeLabel(trip)).toBe("10 – 17 de maio");
  });

  it("repete o mês quando a viagem atravessa a virada", () => {
    expect(
      dateRangeLabel({ ...trip, dateStart: "2026-04-28", dateEnd: "2026-05-05" })
    ).toBe("28 de abril – 5 de maio");
  });

  it("cai no mês aproximado quando não há datas exatas", () => {
    expect(
      dateRangeLabel({ ...trip, dateStart: null, dateEnd: null, targetMonth: "2026-12" })
    ).toBe("dezembro");
  });

  it("devolve null sem datas e sem mês", () => {
    expect(
      dateRangeLabel({ ...trip, dateStart: null, dateEnd: null, targetMonth: null })
    ).toBeNull();
  });

  it("exige as duas pontas para o intervalo exato", () => {
    expect(dateRangeLabel({ ...trip, dateEnd: null, targetMonth: "2026-05" })).toBe("maio");
    expect(dateRangeLabel({ ...trip, dateStart: null, targetMonth: "2026-05" })).toBe("maio");
  });
});

describe("bookingSubtitle", () => {
  it("diz datas, rota e onde a reserva acontece", () => {
    expect(bookingSubtitle(trip)).toBe(
      `Melhores opções para 10 – 17 de maio, GRU → CTG. ${CLOSING}`
    );
  });

  it("omite a rota enquanto o destino não foi escolhido", () => {
    expect(bookingSubtitle({ ...trip, chosenDestination: null })).toBe(
      `Melhores opções para 10 – 17 de maio. ${CLOSING}`
    );
  });

  it("omite as datas quando a viagem ainda não tem quando", () => {
    expect(
      bookingSubtitle({ ...trip, dateStart: null, dateEnd: null, targetMonth: null })
    ).toBe(`Melhores opções para GRU → CTG. ${CLOSING}`);
  });

  it("sem viagem carregada, e sem datas nem destino, sobra só o aviso", () => {
    expect(bookingSubtitle(null)).toBe(CLOSING);
    expect(
      bookingSubtitle({
        ...trip,
        dateStart: null,
        dateEnd: null,
        targetMonth: null,
        chosenDestination: null
      })
    ).toBe(CLOSING);
  });
});

describe("itineraryTitle", () => {
  it("junta destino e duração", () => {
    expect(itineraryTitle({ ...trip, chosenDestination: { city: "Cartagena" } } as never, 7)).toBe(
      "Cartagena · 7 dias"
    );
  });

  it("usa singular com um dia só", () => {
    expect(itineraryTitle({ ...trip, chosenDestination: { city: "Lisboa" } } as never, 1)).toBe(
      "Lisboa · 1 dia"
    );
  });

  it("sem destino, mostra só a duração", () => {
    expect(itineraryTitle(trip as never, 3)).toBe("3 dias");
  });

  it("sem nada, cai no genérico", () => {
    expect(itineraryTitle(null, 0)).toBe("Seu roteiro");
  });
});

describe("itinerarySubtitle", () => {
  it("junta datas e viajantes", () => {
    expect(itinerarySubtitle(trip as never, "2 adultos")).toBe("10 – 17 de maio · 2 adultos");
  });

  it("sem viagem não há subtítulo", () => {
    expect(itinerarySubtitle(null, "2 adultos")).toBeNull();
  });

  it("sem datas nem viajantes, não há subtítulo", () => {
    expect(
      itinerarySubtitle({ ...trip, dateStart: null, dateEnd: null, targetMonth: null } as never, null)
    ).toBeNull();
  });
});

describe("dayPillDate", () => {
  it("abrevia o mês", () => {
    expect(dayPillDate("2026-05-10")).toBe("10 mai");
  });

  it("dia sem data não mostra nada", () => {
    expect(dayPillDate(null)).toBeNull();
  });
});

describe("monthShort", () => {
  it("abrevia o mês e mantém o ano", () => {
    expect(monthShort("2026-09")).toBe("set 2026");
  });

  it("funciona em janeiro", () => {
    expect(monthShort("2027-01")).toBe("jan 2027");
  });
});
