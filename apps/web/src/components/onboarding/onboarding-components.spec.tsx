import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SegmentedControl } from "./SegmentedControl";
import { BudgetPills } from "./BudgetPills";
import { InterestGrid } from "./InterestGrid";
import { INTEREST_OPTIONS, MIN_INTERESTS } from "../../lib/onboarding";

describe("SegmentedControl", () => {
  const options = [
    { value: "relaxado", label: "Relaxado" },
    { value: "intenso", label: "Intenso" }
  ];

  it("marca só a opção selecionada", () => {
    render(
      <SegmentedControl label="Ritmo" options={options} value="intenso" onChange={vi.fn()} />
    );
    expect(screen.getByRole("radio", { name: "Intenso" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Relaxado" })).not.toBeChecked();
  });

  it("nenhuma marcada quando o valor é nulo", () => {
    render(<SegmentedControl label="Ritmo" options={options} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Relaxado" })).not.toBeChecked();
  });

  it("avisa a escolha", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Ritmo" options={options} value={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Relaxado" }));
    expect(onChange).toHaveBeenCalledWith("relaxado");
  });
});

describe("BudgetPills", () => {
  it("mostra as quatro faixas com rótulo em português", () => {
    render(<BudgetPills value={null} onChange={vi.fn()} />);
    for (const label of ["Econômico", "Médio", "Conforto", "Luxo"]) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
  });

  it("avisa a faixa escolhida", async () => {
    const onChange = vi.fn();
    render(<BudgetPills value="medio" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Luxo" }));
    expect(onChange).toHaveBeenCalledWith("luxo");
  });
});

describe("InterestGrid", () => {
  it("lista todos os interesses do catálogo", () => {
    render(<InterestGrid selected={[]} onToggle={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(INTEREST_OPTIONS.length);
  });

  it("marca os selecionados e conta quantos faltam", () => {
    const [first] = INTEREST_OPTIONS;
    render(<InterestGrid selected={[first!]} onToggle={vi.fn()} />);
    expect(screen.getByRole("button", { name: first! })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`1 de ${MIN_INTERESTS} selecionados`)).toBeInTheDocument();
  });

  it("avisa o toggle", async () => {
    const onToggle = vi.fn();
    const [first] = INTEREST_OPTIONS;
    render(<InterestGrid selected={[]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button", { name: first! }));
    expect(onToggle).toHaveBeenCalledWith(first);
  });
});
