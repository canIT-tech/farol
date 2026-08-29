// @ts-nocheck
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("renderiza o label e dispara onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Buscar destinos</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Buscar destinos" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("disabled não dispara onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        x
      </Button>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading marca aria-busy e bloqueia o clique", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} loading>
        Enviar
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("aplica a classe da variante e do tamanho", () => {
    const { rerender } = render(<Button variant="ghost" size="lg">g</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("farol-btn--ghost");
    expect(btn.className).toContain("farol-btn--lg");
    rerender(<Button>d</Button>);
    expect(screen.getByRole("button").className).toContain("farol-btn--primary");
    expect(screen.getByRole("button").className).toContain("farol-btn--md");
  });

  it("é focável por teclado", async () => {
    render(<Button>foco</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("renderiza iconStart antes do label", () => {
    render(
      <Button iconStart={<svg data-testid="ic" />}>label</Button>
    );
    const btn = screen.getByRole("button");
    const ic = screen.getByTestId("ic");
    expect(btn.firstElementChild).toContainElement(ic);
  });

  it("type padrão é button", () => {
    render(<Button>x</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});
