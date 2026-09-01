import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DestinationCandidate } from "@farol/shared";
import { DestinationResults } from "./DestinationResults";

function candidate(
  over: Partial<DestinationCandidate> & Pick<DestinationCandidate, "iata" | "city">
): DestinationCandidate {
  return {
    country: "Portugal",
    score: 0.5,
    rationale: "Justificativa longa o suficiente para passar no schema de candidato.",
    estCost: { flight: 3000, lodgingPerNight: 200, dailyLocal: 100, currency: "BRL" },
    climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null,
    ...over
  };
}

const lisboa = candidate({ iata: "LIS", city: "Lisboa", score: 0.9 });
const recife = candidate({
  iata: "REC",
  city: "Recife",
  country: "Brasil",
  score: 0.7,
  estCost: { flight: 900, lodgingPerNight: 150, dailyLocal: 80, currency: "BRL" }
});
const toquio = candidate({ iata: "HND", city: "Tóquio", country: "Japão", score: 0.8 });

function cidades(): string[] {
  return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent ?? "");
}

describe("DestinationResults", () => {
  it("renderiza um cartão por candidato, ordenado por match", () => {
    render(<DestinationResults destinations={[recife, lisboa, toquio]} onChoose={vi.fn()} />);
    expect(cidades()).toEqual(["Lisboa", "Tóquio", "Recife"]);
  });

  it("o filtro de menor preço reordena", async () => {
    render(<DestinationResults destinations={[lisboa, recife, toquio]} onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Menor preço" }));
    expect(cidades()[0]).toBe("Recife");
  });

  it("o filtro de menor preço desliga no segundo clique", async () => {
    render(<DestinationResults destinations={[lisboa, recife, toquio]} onChoose={vi.fn()} />);
    const chip = screen.getByRole("button", { name: "Menor preço" });
    await userEvent.click(chip);
    await userEvent.click(chip);
    expect(cidades()[0]).toBe("Lisboa");
  });

  it("só nacional filtra os de fora", async () => {
    render(<DestinationResults destinations={[lisboa, recife, toquio]} onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Só nacional" }));
    expect(cidades()).toEqual(["Recife"]);
  });

  it("avisa quando o filtro nacional não deixa nada", async () => {
    render(<DestinationResults destinations={[lisboa, toquio]} onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Só nacional" }));
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum destino nacional");
  });

  it("ver roteiro devolve o iata do cartão", async () => {
    const onChoose = vi.fn();
    render(<DestinationResults destinations={[lisboa, recife]} onChoose={onChoose} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Ver roteiro" })[1]!);
    expect(onChoose).toHaveBeenCalledWith("REC");
  });

  it("salvar alterna por destino", async () => {
    render(<DestinationResults destinations={[lisboa, recife]} onChoose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Salvar Lisboa" }));
    expect(screen.getByRole("button", { name: "Remover Lisboa dos salvos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Recife" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remover Lisboa dos salvos" }));
    expect(screen.getByRole("button", { name: "Salvar Lisboa" })).toBeInTheDocument();
  });

  it("estado vazio quando a descoberta não devolveu nada", () => {
    render(<DestinationResults destinations={[]} onChoose={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum destino combinou");
  });

  it("mostra só custo — sem clima nem tempo de voo, que hoje são placeholder", () => {
    render(<DestinationResults destinations={[lisboa]} onChoose={vi.fn()} />);
    expect(screen.getByText("Voo estimado")).toBeInTheDocument();
    expect(screen.queryByText(/22\s*°C/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tempo de voo/)).not.toBeInTheDocument();
  });
});
