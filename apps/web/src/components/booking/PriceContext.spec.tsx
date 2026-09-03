import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ProviderSection, RouteDeal, RoutePriceSample } from "@farol/shared";
import {
  PriceContext,
  cheapest,
  monthLabel,
  priceRangeLabel,
  shortDate
} from "./PriceContext";

const sample = (departDate: string, price: number): RoutePriceSample => ({
  origin: "SAO",
  destination: "LIS",
  departDate,
  returnDate: null,
  price,
  currency: "brl",
  transfers: 0,
  durationMinutes: 610,
  gate: "Trip.com",
  foundAt: null,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
});

const deal = (key: string, price: number): RouteDeal => ({
  key,
  origin: "SAO",
  destination: "LIS",
  airline: "TP",
  departAt: `${key}-04T18:05:00-03:00`,
  returnAt: null,
  price,
  currency: "brl",
  flightNumber: "748",
  transfers: 0,
  deepLink: "https://www.aviasales.com/search/SAO0411LIS1?marker=555"
});

const ok = <T,>(offers: T[]): ProviderSection<T> => ({
  offers,
  stale: false,
  fetchedAt: null,
  error: null
});
const off = <T,>(): ProviderSection<T> => ({
  offers: [],
  stale: false,
  fetchedAt: null,
  error: "unavailable"
});

describe("helpers", () => {
  it("shortDate formata dia e mês em pt-BR", () => {
    expect(shortDate("2026-11-04")).toMatch(/4 de nov/);
  });

  it("shortDate aceita timestamp completo", () => {
    expect(shortDate("2026-11-04T18:05:00-03:00")).toMatch(/4 de nov/);
  });

  it("monthLabel formata mês e ano", () => {
    expect(monthLabel("2026-11")).toMatch(/nov.* de 2026/);
  });

  it("cheapest devolve o menor preço e null na lista vazia", () => {
    expect(cheapest([deal("2026-11", 900), deal("2026-12", 500)])!.key).toBe("2026-12");
    expect(cheapest([deal("2026-11", 500), deal("2026-12", 900)])!.key).toBe("2026-11");
    expect(cheapest([])).toBeNull();
  });

  it("priceRangeLabel devolve o intervalo e null sem amostras", () => {
    const label = priceRangeLabel([sample("2026-11-04", 500), sample("2026-11-08", 900)])!;
    expect(label).toContain("500");
    expect(label).toContain("900");
    expect(priceRangeLabel([])).toBeNull();
  });
});

describe("PriceContext", () => {
  it("destaca o mês, o dia mais barato e a faixa recente", () => {
    render(
      <PriceContext
        months={ok([deal("2026-11", 3198), deal("2026-12", 2500)])}
        calendar={ok([sample("2026-11-04", 900), sample("2026-11-08", 700)])}
        latest={ok([sample("2026-10-01", 2500), sample("2026-10-20", 4100)])}
      />
    );

    expect(screen.getByRole("heading", { name: "Melhor mês" })).toBeInTheDocument();
    // O destaque e a linha da lista mostram o mesmo mês/dia — dois nós, um valor.
    expect(screen.getAllByText(/dez.* de 2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/8 de nov/).length).toBeGreaterThan(0);
    expect(screen.getByText(/esta rota saiu entre/)).toBeInTheDocument();
  });

  it("some com o bloco cujo provider falhou, sem derrubar os outros", () => {
    render(
      <PriceContext months={off()} calendar={ok([sample("2026-11-04", 900)])} latest={off()} />
    );

    expect(screen.queryByRole("heading", { name: "Melhor mês" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Faixa recente" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Melhor dia do mês" })).toBeInTheDocument();
  });

  it("avisa quando o provider respondeu mas não achou preço", () => {
    render(<PriceContext months={ok([])} calendar={ok([])} latest={ok([])} />);

    expect(screen.getByText("Sem histórico de preço por mês nesta rota.")).toBeInTheDocument();
    expect(screen.getByText("Sem calendário de preço nesta rota.")).toBeInTheDocument();
    expect(screen.getByText("Sem preços recentes nesta rota.")).toBeInTheDocument();
  });
});
