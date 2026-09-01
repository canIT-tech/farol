import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutoForm } from "./AutoForm";

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Saindo de"), "GRU");
  await user.type(screen.getByLabelText("Ida"), "2026-09-10");
  await user.type(screen.getByLabelText("Volta"), "2026-09-17");
  for (const gosto of ["praia", "gastronomia", "natureza"]) {
    await user.click(screen.getByRole("button", { name: gosto }));
  }
}

describe("AutoForm", () => {
  it("pede exatamente três gostos", () => {
    render(<AutoForm onSubmit={vi.fn()} />);
    expect(screen.getByText("Escolha 3 gostos")).toBeInTheDocument();
    expect(screen.getByText("0 de 3")).toBeInTheDocument();
  });

  it("não deixa enviar incompleto", () => {
    render(<AutoForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Montar meu plano/ })).toBeDisabled();
  });

  it("conta os gostos escolhidos", async () => {
    const user = userEvent.setup();
    render(<AutoForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "praia" }));
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
  });

  it("o quarto gosto substitui o mais antigo", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AutoForm onSubmit={onSubmit} />);
    await preencher(user);
    await user.click(screen.getByRole("button", { name: "vinhos" }));
    await user.click(screen.getByRole("button", { name: /Montar meu plano/ }));
    expect(onSubmit.mock.calls[0]![0]!.interests).toEqual([
      "gastronomia",
      "natureza",
      "vinhos"
    ]);
  });

  it("envia origem, datas, orçamento e gostos", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<AutoForm onSubmit={onSubmit} />);
    await preencher(user);
    fireEvent.change(screen.getByLabelText("Orçamento total"), { target: { value: "20000" } });
    await user.click(screen.getByRole("button", { name: /Montar meu plano/ }));

    expect(onSubmit.mock.calls[0]![0]).toEqual({
      originIata: "GRU",
      dateStart: "2026-09-10",
      dateEnd: "2026-09-17",
      budgetTotal: 20_000,
      interests: ["praia", "gastronomia", "natureza"]
    });
  });

  it("não chama onSubmit num envio inválido", () => {
    const onSubmit = vi.fn();
    const { container } = render(<AutoForm onSubmit={onSubmit} />);
    container.querySelector("form")!.requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pending bloqueia o envio", async () => {
    const user = userEvent.setup();
    render(<AutoForm onSubmit={vi.fn()} pending />);
    await preencher(user);
    expect(screen.getByRole("button", { name: /Montar meu plano/ })).toBeDisabled();
  });

  it("desmarcar um gosto tira da conta", async () => {
    const user = userEvent.setup();
    render(<AutoForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "praia" }));
    await user.click(screen.getByRole("button", { name: "praia" }));
    expect(screen.getByText("0 de 3")).toBeInTheDocument();
  });
});
