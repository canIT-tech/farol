import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TripState } from "@farol/shared";
import { TripSidebar, tripSteps } from "./TripSidebar";

const base: TripState = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: null,
  dateEnd: null,
  durationDays: 7,
  targetMonth: "2026-09",
  party: { adults: 2, children: 1 },
  budgetTotal: 12000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  destinations: [],
  chosenDestination: null
};

const candidate = {
  iata: "LIS",
  city: "Lisboa",
  country: "Portugal",
  score: 0.82,
  rationale: "Justificativa longa o suficiente para passar no schema de candidato.",
  estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
  climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
  flightTimeHours: null,
  flightStops: null
};

describe("tripSteps", () => {
  it("segue as etapas do hi-fi, com os ids iguais aos segmentos de rota", () => {
    expect(tripSteps(base).map((s) => [s.id, s.label])).toEqual([
      ["profile", "Perfil de gosto"],
      ["discovery", "Escolher destino"],
      ["itinerary", "Roteiro"],
      ["booking", "Voo & hotel"]
    ]);
  });

  it("sem destino escolhido: perfil feito, escolher destino é o passo atual", () => {
    expect(tripSteps(base).map((s) => s.state)).toEqual(["done", "current", "todo", "todo"]);
    expect(tripSteps({ ...base, destinations: [candidate] }).map((s) => s.state)).toEqual([
      "done",
      "current",
      "todo",
      "todo"
    ]);
  });

  it("com destino escolhido: roteiro liberado, voo & hotel é o passo atual", () => {
    const steps = tripSteps({
      ...base,
      destinations: [candidate],
      chosenDestination: candidate
    });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
  });

  it("sem viagem devolve tudo a fazer", () => {
    expect(tripSteps(null).every((s) => s.state === "todo")).toBe(true);
  });
});

describe("TripSidebar", () => {
  it("mostra origem, período, viajantes e orçamento", () => {
    render(<TripSidebar trip={base} />);
    expect(screen.getByText("GRU")).toBeInTheDocument();
    expect(screen.getByText("2026-09 · 7 dias")).toBeInTheDocument();
    expect(screen.getByText("2 adultos · 1 criança")).toBeInTheDocument();
    expect(screen.getByText(/12\.000/)).toBeInTheDocument();
  });

  it("usa datas exatas quando existem", () => {
    render(
      <TripSidebar
        trip={{ ...base, dateStart: "2026-09-10", dateEnd: "2026-09-17", targetMonth: null, durationDays: null }}
      />
    );
    expect(screen.getByText("2026-09-10 → 2026-09-17")).toBeInTheDocument();
  });

  it("singular de adulto e ausência de criança", () => {
    render(<TripSidebar trip={{ ...base, party: { adults: 1, children: 0 } }} />);
    expect(screen.getByText("1 adulto")).toBeInTheDocument();
  });

  it("plural de crianças", () => {
    render(<TripSidebar trip={{ ...base, party: { adults: 2, children: 3 } }} />);
    expect(screen.getByText("2 adultos · 3 crianças")).toBeInTheDocument();
  });

  it("período indefinido quando não há data nem mês", () => {
    render(<TripSidebar trip={{ ...base, targetMonth: null, durationDays: null }} />);
    expect(screen.getByText("a definir")).toBeInTheDocument();
  });

  it("orçamento a definir quando é nulo", () => {
    render(<TripSidebar trip={{ ...base, budgetTotal: null }} />);
    expect(screen.getAllByText("a definir").length).toBeGreaterThan(0);
  });

  it("mostra o destino escolhido quando há um", () => {
    render(<TripSidebar trip={{ ...base, chosenDestination: candidate }} />);
    expect(screen.getByText("Lisboa, Portugal")).toBeInTheDocument();
  });

  it("estado de carregando quando não há viagem", () => {
    render(<TripSidebar trip={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
  });

  it("navega pelos passos já concluídos", async () => {
    const onNavigate = vi.fn();
    render(
      <TripSidebar
        trip={{ ...base, destinations: [candidate], chosenDestination: candidate }}
        onNavigate={onNavigate}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Escolher destino" }));
    expect(onNavigate).toHaveBeenCalledWith("discovery");
  });
});
