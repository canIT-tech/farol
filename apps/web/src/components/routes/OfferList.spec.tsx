import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { FlightOffer, ProviderSection } from "@farol/shared";
import { OfferList } from "./OfferList";

afterEach(cleanup);

const base: FlightOffer = {
  id: "gf:LA:LA755-LA800:2027-02-11:6420",
  price: 6420,
  currency: "BRL",
  carrier: "LA",
  carrierName: "LATAM",
  originIata: "FLN",
  originName: "Florianópolis",
  destinationIata: "SYD",
  destinationName: "Sydney",
  stops: 1,
  segments: [
    {
      fromIata: "FLN",
      fromName: "Florianópolis",
      toIata: "SCL",
      toName: "Santiago",
      departAt: "2027-02-11T06:15:00",
      arriveAt: "2027-02-11T10:40:00",
      durationMinutes: 265,
      flightNumber: "LA755"
    },
    {
      fromIata: "SCL",
      fromName: "Santiago",
      toIata: "SYD",
      toName: "Sydney",
      departAt: "2027-02-11T14:30:00",
      arriveAt: "2027-02-12T22:05:00",
      durationMinutes: 815,
      flightNumber: "LA800"
    }
  ],
  departAt: "2027-02-11T06:15:00",
  arriveAt: "2027-02-12T22:05:00",
  returnAt: null,
  durationMinutes: 2510,
  deepLink: "https://www.google.com/travel/flights?tfs=abc"
};

function section(
  offers: FlightOffer[],
  over: Partial<ProviderSection<FlightOffer>> = {}
): ProviderSection<FlightOffer> {
  return { offers, stale: false, fetchedAt: null, error: null, ...over };
}

describe("OfferList", () => {
  it("mostra o caminho quando o provider informa os trechos", () => {
    render(<OfferList section={section([base])} />);
    expect(screen.getByTestId("offer-path")).toHaveTextContent("FLN → SCL → SYD");
  });

  it("mostra preço e companhia", () => {
    render(<OfferList section={section([base])} />);
    expect(screen.getByText("LATAM")).toBeInTheDocument();
    expect(screen.getByText(/6\.420/)).toBeInTheDocument();
  });

  it("mostra a duração porta a porta em horas e minutos", () => {
    render(<OfferList section={section([base])} />);
    expect(screen.getByText("41h50")).toBeInTheDocument();
  });

  // Sem trechos o caminho não existe. Mostrar a contagem é o que se sabe;
  // inventar um caminho seria pior que não ter.
  it("cai na contagem de escalas quando não há trechos", () => {
    render(<OfferList section={section([{ ...base, segments: [] }])} />);
    expect(screen.queryByTestId("offer-path")).toBeNull();
    expect(screen.getByText("1 escala")).toBeInTheDocument();
  });

  it("escreve direto quando não há escala", () => {
    render(<OfferList section={section([{ ...base, stops: 0, segments: [] }])} />);
    expect(screen.getByText("direto")).toBeInTheDocument();
  });

  it("pluraliza as escalas", () => {
    render(<OfferList section={section([{ ...base, stops: 2, segments: [] }])} />);
    expect(screen.getByText("2 escalas")).toBeInTheDocument();
  });

  it("cai no código da companhia quando não há nome", () => {
    render(<OfferList section={section([{ ...base, carrierName: null }])} />);
    expect(screen.getByText("LA")).toBeInTheDocument();
  });

  it("avisa quando o provider está fora do ar", () => {
    render(<OfferList section={section([], { error: "unavailable" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("não consegui buscar voo agora");
  });

  it("avisa quando não achou nada", () => {
    render(<OfferList section={section([])} />);
    expect(screen.getByRole("status")).toHaveTextContent("nenhum voo para essa data");
  });
});
