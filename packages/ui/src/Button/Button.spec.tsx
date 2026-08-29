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

  it("disabled não dispara onClick e não marca aria-busy", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        x
      </Button>
    );
    const btn = screen.getByRole("button");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
    expect(btn).not.toHaveAttribute("aria-busy");
  });

  it("loading marca aria-busy=true, desabilita e bloqueia o clique", async () => {
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

  it("loading mostra o spinner e esconde os ícones", () => {
    render(
      <Button loading iconStart={<svg data-testid="ic-start" />} iconEnd={<svg data-testid="ic-end" />}>
        x
      </Button>
    );
    expect(screen.getByRole("button").querySelector(".farol-btn__spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("ic-start")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ic-end")).not.toBeInTheDocument();
  });

  it("variante e tamanho padrão são primary/md", () => {
    render(<Button>d</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("farol-btn--primary");
    expect(btn.className).toContain("farol-btn--md");
  });

  it("aplica a classe da variante e do tamanho pedidos", () => {
    render(
      <Button variant="ghost" size="lg">
        g
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("farol-btn--ghost");
    expect(btn.className).toContain("farol-btn--lg");
    expect(btn.className).not.toContain("farol-btn--primary");
  });

  it("preserva a className passada e não deixa lixo na lista", () => {
    render(<Button className="extra">c</Button>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("extra");
    expect(cls).not.toContain("false");
    expect(cls).not.toContain("undefined");
    expect(cls.trim()).toBe(cls);
  });

  it("repassa props do DOM (aria-label, data-*)", () => {
    render(
      <Button aria-label="fechar" data-testid="b">
        x
      </Button>
    );
    const btn = screen.getByTestId("b");
    expect(btn).toHaveAttribute("aria-label", "fechar");
  });

  it("é focável por teclado", async () => {
    render(<Button>foco</Button>);
    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();
  });

  it("renderiza iconStart antes e iconEnd depois do label", () => {
    render(
      <Button iconStart={<svg data-testid="ic-start" />} iconEnd={<svg data-testid="ic-end" />}>
        <span data-testid="label">label</span>
      </Button>
    );
    const btn = screen.getByRole("button");
    const kids = Array.from(btn.children);
    const startIdx = kids.findIndex((k) => k.contains(screen.getByTestId("ic-start")));
    const labelIdx = kids.findIndex((k) => k.contains(screen.getByTestId("label")));
    const endIdx = kids.findIndex((k) => k.contains(screen.getByTestId("ic-end")));
    expect(startIdx).toBeLessThan(labelIdx);
    expect(labelIdx).toBeLessThan(endIdx);
  });

  it("sem iconEnd não renderiza wrapper extra", () => {
    render(<Button iconStart={<svg data-testid="ic" />}>x</Button>);
    expect(screen.getByRole("button").querySelectorAll(".farol-btn__icon")).toHaveLength(1);
  });

  it("type padrão é button e pode virar submit", () => {
    const { rerender } = render(<Button>x</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    rerender(<Button type="submit">x</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
