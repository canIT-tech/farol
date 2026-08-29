import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "./TextField";

afterEach(cleanup);

describe("TextField", () => {
  it("associa o label ao input e digitar chama onChange", async () => {
    const onChange = vi.fn();
    render(<TextField label="Saindo de" value="" onChange={onChange} />);
    const input = screen.getByLabelText("Saindo de");
    await userEvent.type(input, "G");
    expect(onChange).toHaveBeenCalledWith("G");
  });

  it("clicar no label foca o input", async () => {
    render(<TextField label="Origem" value="" onChange={() => {}} />);
    await userEvent.click(screen.getByText("Origem"));
    expect(screen.getByLabelText("Origem")).toHaveFocus();
  });

  it("error renderiza a mensagem, marca aria-invalid e liga aria-describedby", () => {
    render(<TextField label="Orçamento" value="" onChange={() => {}} error="Mínimo R$ 1.500" />);
    const input = screen.getByLabelText("Orçamento");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const msg = screen.getByText("Mínimo R$ 1.500");
    expect(input.getAttribute("aria-describedby")).toBe(msg.id);
    expect(msg.className).toContain("farol-field__error");
  });

  it("hint aparece quando não há error", () => {
    render(<TextField label="x" value="" onChange={() => {}} hint="opcional" />);
    const input = screen.getByLabelText("x");
    const hint = screen.getByText("opcional");
    expect(hint.className).toContain("farol-field__hint");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input.getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("error tem prioridade sobre hint", () => {
    render(<TextField label="x" value="" onChange={() => {}} hint="dica" error="erro" />);
    expect(screen.queryByText("dica")).not.toBeInTheDocument();
    expect(screen.getByText("erro")).toBeInTheDocument();
  });

  it("sem error nem hint não renderiza parágrafo de apoio", () => {
    const { container } = render(<TextField label="x" value="" onChange={() => {}} />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("classe do control: exata com erro, sem lixo sem erro", () => {
    const { container, rerender } = render(
      <TextField label="x" value="" onChange={() => {}} error="e" />
    );
    expect(container.querySelector(".farol-field__control")!.className).toBe(
      "farol-field__control farol-field__control--error"
    );
    rerender(<TextField label="x" value="" onChange={() => {}} />);
    const cls = container.querySelector(".farol-field__control")!.className;
    expect(cls).toBe("farol-field__control");
    expect(cls).not.toContain("false");
  });

  it("renderiza iconStart e repassa placeholder e disabled", () => {
    render(
      <TextField
        label="x"
        value=""
        onChange={() => {}}
        iconStart={<svg data-testid="ic" />}
        placeholder="ph"
        disabled
      />
    );
    expect(screen.getByTestId("ic")).toBeInTheDocument();
    const input = screen.getByLabelText("x");
    expect(input).toHaveAttribute("placeholder", "ph");
    expect(input).toBeDisabled();
  });

  it("reflete o value controlado", () => {
    render(<TextField label="x" value="São Paulo" onChange={() => {}} />);
    expect(screen.getByLabelText("x")).toHaveValue("São Paulo");
  });
});
