import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper } from "./Stepper";

afterEach(cleanup);

describe("Stepper", () => {
  it("+ e – chamam onChange com value ± step", async () => {
    const onChange = vi.fn();
    render(<Stepper label="Adultos" value={2} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Aumentar Adultos" }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole("button", { name: "Diminuir Adultos" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("usa o step informado", async () => {
    const onChange = vi.fn();
    render(<Stepper label="x" value={10} step={5} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Aumentar x" }));
    expect(onChange).toHaveBeenCalledWith(15);
  });

  it("respeita min: desabilita – e faz clamp", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Stepper label="x" value={1} min={0} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Diminuir x" }));
    expect(onChange).toHaveBeenCalledWith(0);
    rerender(<Stepper label="x" value={0} min={0} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Diminuir x" })).toBeDisabled();
  });

  it("respeita max: desabilita + no limite", () => {
    render(<Stepper label="x" value={5} max={5} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Aumentar x" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Diminuir x" })).not.toBeDisabled();
  });

  it("clamp no + quando value+step passa de max", async () => {
    const onChange = vi.fn();
    render(<Stepper label="x" value={4} step={3} max={5} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Aumentar x" }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("mostra o value e o grupo é rotulado pelo label", () => {
    render(<Stepper label="Viajantes" value={3} onChange={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Viajantes" })).toBeInTheDocument();
  });

  it("botões são focáveis por teclado", async () => {
    render(<Stepper label="x" value={1} onChange={() => {}} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Diminuir x" })).toHaveFocus();
  });
});
