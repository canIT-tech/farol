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

  it("abre no ano corrente quando não há escolha", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} today={new Date("2030-03-10T12:00:00Z")} />);
    await abrir();
    expect(screen.getByText("2030")).toBeInTheDocument();
  });

  // Sem o `today`, o ano vem do relógio. Comparar com o ano de verdade em vez
  // de com um número escrito aqui: a versão antiga cravava 2026 e teria
  // quebrado sozinha na virada do ano.
  it("usa o ano do relógio quando nenhuma data é passada", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} />);
    await abrir();
    expect(screen.getByText(String(new Date().getUTCFullYear()))).toBeInTheDocument();
  });

  it("navega para os anos seguintes e volta", async () => {
    render(<MonthField label="Mês" value="" onChange={vi.fn()} today={new Date("2026-09-04T12:00:00Z")} />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));
    expect(screen.getByText("2028")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ano anterior" }));
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

describe("MonthField não deixa escolher o passado", () => {
  // A viagem quebrada nasceu daqui: "mai" clicável com 2026 na tela, em
  // setembro de 2026. Voo e hotel voltaram vazios porque a data já tinha
  // passado, e nada na tela dizia isso.
  const hoje = new Date("2026-09-04T12:00:00Z");

  it("desabilita os meses que já passaram no ano corrente", async () => {
    render(<MonthField label="Mês" value="" onChange={() => {}} today={hoje} />);
    await userEvent.click(screen.getByRole("button", { name: /mês/i }));

    expect(screen.getByRole("button", { name: "mai" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "ago" })).toBeDisabled();
    // O mês corrente continua disponível.
    expect(screen.getByRole("button", { name: "set" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "out" })).toBeEnabled();
  });

  it("não avisa a quem chama quando um mês passado é clicado", async () => {
    const onChange = vi.fn();
    render(<MonthField label="Mês" value="" onChange={onChange} today={hoje} />);
    await userEvent.click(screen.getByRole("button", { name: /mês/i }));
    await userEvent.click(screen.getByRole("button", { name: "mai" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("abre no ano corrente, não num ano cravado no código", async () => {
    render(<MonthField label="Mês" value="" onChange={() => {}} today={hoje} />);
    await userEvent.click(screen.getByRole("button", { name: /mês/i }));
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  // Voltar para um ano inteiro no passado não tem uso, e é o caminho mais curto
  // para montar de novo uma viagem que não existe.
  it("não deixa voltar para antes do ano corrente", async () => {
    render(<MonthField label="Mês" value="" onChange={() => {}} today={hoje} />);
    await userEvent.click(screen.getByRole("button", { name: /mês/i }));
    expect(screen.getByRole("button", { name: "Ano anterior" })).toBeDisabled();
  });

  it("libera todos os meses de um ano futuro", async () => {
    render(<MonthField label="Mês" value="" onChange={() => {}} today={hoje} />);
    await userEvent.click(screen.getByRole("button", { name: /mês/i }));
    await userEvent.click(screen.getByRole("button", { name: "Próximo ano" }));

    expect(screen.getByText("2027")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "jan" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "mai" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ano anterior" })).toBeEnabled();
  });
});
