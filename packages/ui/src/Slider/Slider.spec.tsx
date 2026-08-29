import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Slider } from "./Slider";

afterEach(cleanup);

describe("Slider", () => {
  it("é um range rotulado pelo label, com min/max/step", () => {
    render(<Slider label="Orçamento" value={5000} min={1500} max={12000} step={100} onChange={() => {}} />);
    const input = screen.getByRole("slider", { name: "Orçamento" });
    expect(input).toHaveAttribute("min", "1500");
    expect(input).toHaveAttribute("max", "12000");
    expect(input).toHaveAttribute("step", "100");
    expect(input).toHaveValue("5000");
  });

  it("mudar o valor chama onChange com número", () => {
    const onChange = vi.fn();
    render(<Slider label="x" value={10} min={0} max={100} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  // Stepping por seta é comportamento nativo do <input type=range> (não
  // implementado por nós); jsdom não o simula. Coberto pelo e2e no Plano 8.
  it("é focável por teclado", async () => {
    render(<Slider label="x" value={10} min={0} max={100} onChange={() => {}} />);
    await userEvent.tab();
    expect(screen.getByRole("slider")).toHaveFocus();
  });

  it("formatValue formata o texto visível", () => {
    render(
      <Slider
        label="x"
        value={5000}
        min={0}
        max={12000}
        onChange={() => {}}
        formatValue={(n) => `R$ ${n.toLocaleString("pt-BR")}`}
      />
    );
    expect(screen.getByText("R$ 5.000")).toBeInTheDocument();
  });

  it("sem formatValue mostra o número cru", () => {
    render(<Slider label="x" value={7} min={0} max={10} onChange={() => {}} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("preenchimento proporcional via --farol-slider-pct (min não-zero)", () => {
    // (3000-1500)/(12000-1500)*100 ≈ 14.2857%
    render(<Slider label="x" value={3000} min={1500} max={12000} onChange={() => {}} />);
    const style = screen.getByRole("slider").getAttribute("style") ?? "";
    const pct = Number(/--farol-slider-pct:\s*([\d.]+)%/.exec(style)?.[1]);
    expect(pct).toBeCloseTo(14.2857, 3);
  });

  it("value no máximo -> 100%", () => {
    render(<Slider label="x" value={12000} min={1500} max={12000} onChange={() => {}} />);
    expect(screen.getByRole("slider").getAttribute("style")).toContain("--farol-slider-pct: 100%");
  });

  it("min === max não divide por zero (pct 0)", () => {
    render(<Slider label="x" value={5} min={5} max={5} onChange={() => {}} />);
    expect(screen.getByRole("slider").getAttribute("style")).toContain("--farol-slider-pct: 0%");
  });
});
