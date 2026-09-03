import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangeField } from "./DateRangeField";

afterEach(cleanup);

const maio = { year: 2026, month: 5 };

function abrir() {
  return userEvent.click(screen.getByRole("button", { name: /Quando/ }));
}

describe("DateRangeField — fechado", () => {
  it("mostra o placeholder sem datas", () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} />);
    expect(screen.getByText("Escolha as datas")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("aceita um placeholder próprio", () => {
    render(
      <DateRangeField label="Quando" start="" end="" onChange={vi.fn()} placeholder="Ida e volta" />
    );
    expect(screen.getByText("Ida e volta")).toBeInTheDocument();
  });

  it("mostra o intervalo escolhido", () => {
    render(
      <DateRangeField label="Quando" start="2026-05-10" end="2026-05-17" onChange={vi.fn()} />
    );
    expect(screen.getByText("10 – 17 mai 2026")).toBeInTheDocument();
  });
});

describe("DateRangeField — calendário", () => {
  it("abre e fecha no clique do campo", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} initialMonth={maio} />);
    await abrir();
    expect(screen.getByRole("dialog", { name: "Quando" })).toBeInTheDocument();
    await abrir();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre no mês da ida quando já existe uma", async () => {
    render(
      <DateRangeField label="Quando" start="2026-08-03" end="" onChange={vi.fn()} initialMonth={maio} />
    );
    await abrir();
    expect(screen.getByText("agosto de 2026")).toBeInTheDocument();
  });

  it("abre no mês inicial quando não há ida", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} initialMonth={maio} />);
    await abrir();
    expect(screen.getByText("maio de 2026")).toBeInTheDocument();
  });

  it("usa janeiro de 2026 quando nenhum mês é passado", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} />);
    await abrir();
    expect(screen.getByText("janeiro de 2026")).toBeInTheDocument();
  });

  it("navega para o mês anterior e para o próximo", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} initialMonth={maio} />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByText("abril de 2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByText("junho de 2026")).toBeInTheDocument();
  });

  it("fecha quando o foco sai do campo", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} initialMonth={maio} />);
    await abrir();
    await userEvent.click(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("segue aberto enquanto o foco anda dentro do calendário", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} initialMonth={maio} />);
    await abrir();
    await userEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("DateRangeField — escolha", () => {
  it("o primeiro dia clicado vira a ida e o calendário segue aberto", async () => {
    const onChange = vi.fn();
    render(<DateRangeField label="Quando" start="" end="" onChange={onChange} initialMonth={maio} />);
    await abrir();
    await userEvent.click(screen.getByRole("gridcell", { name: "10" }));

    expect(onChange).toHaveBeenCalledWith({ start: "2026-05-10", end: "" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("o segundo dia fecha o intervalo e o calendário", async () => {
    const onChange = vi.fn();
    render(
      <DateRangeField label="Quando" start="2026-05-10" end="" onChange={onChange} initialMonth={maio} />
    );
    await abrir();
    await userEvent.click(screen.getByRole("gridcell", { name: "17" }));

    expect(onChange).toHaveBeenCalledWith({ start: "2026-05-10", end: "2026-05-17" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("marca ida, volta e o miolo do intervalo", async () => {
    render(
      <DateRangeField
        label="Quando"
        start="2026-05-10"
        end="2026-05-17"
        onChange={vi.fn()}
        initialMonth={maio}
      />
    );
    await abrir();

    expect(screen.getByRole("gridcell", { name: "10" })).toHaveClass("farol-daterange__day--start");
    expect(screen.getByRole("gridcell", { name: "17" })).toHaveClass("farol-daterange__day--end");
    expect(screen.getByRole("gridcell", { name: "12" })).toHaveClass("farol-daterange__day--inside");
    expect(screen.getByRole("gridcell", { name: "20" })).not.toHaveClass(
      "farol-daterange__day--inside"
    );
  });

  it("as pontas ficam marcadas como escolhidas", async () => {
    render(
      <DateRangeField
        label="Quando"
        start="2026-05-10"
        end="2026-05-17"
        onChange={vi.fn()}
        initialMonth={maio}
      />
    );
    await abrir();
    expect(screen.getByRole("gridcell", { name: "10" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("gridcell", { name: "12" })).toHaveAttribute("aria-pressed", "false");
  });

  it("as casas antes do dia 1 não são clicáveis", async () => {
    render(<DateRangeField label="Quando" start="" end="" onChange={vi.fn()} initialMonth={maio} />);
    await abrir();
    // Maio de 2026 começa na sexta: 5 casas vazias antes do dia 1.
    expect(screen.getAllByRole("gridcell")).toHaveLength(31);
  });
});
