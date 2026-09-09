import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProviderSection, RouteDeal } from "@farol/shared";
import { MonthList } from "./MonthList";

afterEach(cleanup);

const deal = (key: string, price: number, departAt: string): RouteDeal => ({
  key,
  origin: "FLN",
  destination: "SYD",
  airline: "LA",
  departAt,
  returnAt: null,
  price,
  currency: "BRL",
  flightNumber: "800",
  transfers: 1,
  deepLink: "https://www.aviasales.com/search"
});

function section(
  offers: RouteDeal[],
  over: Partial<ProviderSection<RouteDeal>> = {}
): ProviderSection<RouteDeal> {
  return { offers, stale: false, fetchedAt: null, error: null, ...over };
}

const deals = [
  deal("2027-01", 9000, "2027-01-08T06:00:00"),
  deal("2027-02", 6420, "2027-02-11T06:15:00")
];

describe("MonthList", () => {
  it("escreve os meses por extenso", () => {
    render(<MonthList section={section(deals)} onPick={vi.fn()} />);
    expect(screen.getByText("fevereiro de 2027")).toBeInTheDocument();
    expect(screen.getByText("janeiro de 2027")).toBeInTheDocument();
  });

  it("marca o mais barato", () => {
    render(<MonthList section={section(deals)} onPick={vi.fn()} />);
    expect(screen.getByTestId("cheapest-month")).toHaveTextContent("fevereiro de 2027");
  });

  // O RouteDeal já traz um departAt concreto junto do mês — é o que liga o
  // passo 1 ao passo 2 sem um endpoint de calendário no meio.
  it("clicar num mês devolve a data daquele achado", async () => {
    const onPick = vi.fn();
    render(<MonthList section={section(deals)} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /fevereiro de 2027/ }));
    expect(onPick).toHaveBeenCalledWith("2027-02-11");
  });

  // Vazio aqui não é falha: o /prices/monthly serve cache do parceiro, e uma
  // rota que quase ninguém pesquisa simplesmente não tem linha.
  it("diz que não há histórico em vez de fingir erro", () => {
    render(<MonthList section={section([])} onPick={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "sem histórico de preço para essa rota"
    );
  });

  it("avisa quando o provider caiu", () => {
    render(<MonthList section={section([], { error: "unavailable" })} onPick={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "não consegui consultar os meses agora"
    );
  });
});
