import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthField } from "./MonthField";

afterEach(cleanup);

const abrir = () => userEvent.click(screen.getByRole("button", { name: /Mês/ }));

describe("MonthField — fechado", () => {
  it("mostra o placeholder sem escolha", () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    expect(screen.getByText("Escolha o mês")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aceita um placeholder próprio", () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} placeholder="Quando mais ou menos" />);
    expect(screen.getByText("Quando mais ou menos")).toBeInTheDocument();
  });

  it("mostra o mês escolhido por extenso", () => {
    render(<MonthField label="Mês" value="2026-09" onChange={vi.fn()} />);
    expect(screen.getByText("setembro de 2026")).toBeInTheDocument();
  });
});

describe("MonthField — seletor", () => {
  it("abre e fecha no clique do campo", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    await abrir();
    expect(screen.getByRole("dialog", { name: "Mês" })).toBeInTheDocument();
    await abrir();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre no ano da escolha quando já existe uma", async () => {
    render(<MonthField label="Mês" value="2029-03" onChange={vi.fn()} initialYear={2026} />);
    await abrir();
    expect(screen.getByText("2029")).toBeInTheDocument();
  });

  it("abre no ano inicial quando não há escolha", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} initialYear={2030} />);
    await abrir();
    expect(screen.getByText("2030")).toBeInTheDocument();
  });

  it("usa 2026 quando nenhum ano é passado", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    await abrir();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("navega entre os anos", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} initialYear={2026} />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
    expect(screen.getByText("2025")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(screen.getByText("2027")).toBeInTheDocument();
  });

  it("mostra os doze meses", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    await abrir();
    expect(screen.getByRole("button", { name: "jan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dez" })).toBeInTheDocument();
  });

  it("escolher um mês devolve a chave e fecha", async () => {
    const onChange = vi.fn();
    render(<MonthField label="Mês" value="" onChange={onChange} initialYear={2026} />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "set" }));

    expect(onChange).toHaveBeenCalledWith("2026-09");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("o mês escolhido fica marcado, e só no ano dele", async () => {
    render(<MonthField label="Mês" value="2026-09" onChange={vi.fn()} />);
    await abrir();
    expect(screen.getByRole("button", { name: "set" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "out" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(screen.getByRole("button", { name: "set" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fecha quando o foco sai do campo", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    await abrir();
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("segue aberto enquanto o foco anda dentro do seletor", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
