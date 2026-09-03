import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Chip } from "./Chip";

afterEach(cleanup);

describe("Chip", () => {
  it("sem onClick é um span informativo (sem role button)", () => {
    render(<Chip>Praia</Chip>);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Praia").tagName).toBe("SPAN");
  });

  it("com onClick é button com aria-pressed refletindo selected", () => {
    const { rerender } = render(
      <Chip onClick={() => {}} selected>
        Praia
      </Chip>
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    rerender(<Chip onClick={() => {}}>Praia</Chip>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("dispara onClick no clique e no teclado (Enter/Espaço)", async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>x</Chip>);
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    btn.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("aplica classe por tone e selected", () => {
    render(
      <Chip tone="taste" selected onClick={() => {}}>
        Sossego
      </Chip>
    );
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("farol-chip--taste");
    expect(cls).toContain("farol-chip--selected");
    expect(cls).toContain("farol-chip--interactive");
    expect(cls).not.toContain("false");
  });

  it("tone padrão é filter e não-interativo não ganha classe interactive", () => {
    render(<Chip>Todos</Chip>);
    const cls = screen.getByText("Todos").className;
    expect(cls).toContain("farol-chip--filter");
    expect(cls).not.toContain("farol-chip--interactive");
    expect(cls).not.toContain("farol-chip--selected");
  });

  it("como aba usa aria-selected, não aria-pressed", () => {
    render(
      <Chip role="tab" selected onClick={() => {}}>
        Voos
      </Chip>
    );
    const tab = screen.getByRole("tab", { name: "Voos" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).not.toHaveAttribute("aria-pressed");
  });

  it("aba não selecionada marca aria-selected false", () => {
    render(
      <Chip role="tab" onClick={() => {}}>
        Hotéis
      </Chip>
    );
    expect(screen.getByRole("tab", { name: "Hotéis" })).toHaveAttribute("aria-selected", "false");
  });

  it("fora de um tablist segue usando aria-pressed", () => {
    render(<Chip onClick={() => {}}>Só nacional</Chip>);
    const chip = screen.getByRole("button", { name: "Só nacional" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).not.toHaveAttribute("aria-selected");
  });
});
