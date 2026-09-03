import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscoveryForm } from "./DiscoveryForm";

// O campo de origem chama /geo no mount e a cada tecla. Sem este mock a suíte
// bateria na rede; o comportamento do campo está em OriginField.spec.tsx.
vi.mock("../../lib/geo-api", () => ({
  whereami: vi.fn(() => Promise.resolve(null)),
  searchAirports: vi.fn(() => Promise.resolve([]))
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

async function preencherPorMes(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Saindo de"), "gru");
  // O seletor de mês abre em 2026; setembro está na grade do ano.
  await user.click(screen.getByRole("button", { name: /^Mês/ }));
  await user.click(screen.getByRole("button", { name: "set" }));
}

describe("DiscoveryForm", () => {
  it("começa no modo mês, com dias de viagem", () => {
    render(<DiscoveryForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Mês/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Dias de viagem")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Datas/ })).not.toBeInTheDocument();
  });

  it("o toggle troca para datas exatas", async () => {
    const user = userEvent.setup();
    render(<DiscoveryForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Datas exatas" }));
    expect(screen.getByRole("button", { name: /Datas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mês/ })).not.toBeInTheDocument();
  });

  it("submit fica bloqueado enquanto o input não é válido", () => {
    render(<DiscoveryForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Buscar destinos/ })).toBeDisabled();
  });

  it("submit válido no modo mês manda o body do tripInputSchema", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm onSubmit={onSubmit} />);
    await preencherPorMes(user);
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      originIata: "GRU",
      targetMonth: "2026-09",
      durationDays: 7,
      party: { adults: 2, children: 0 }
    });
  });

  it("submit válido no modo datas manda as datas", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Saindo de"), "GRU");
    await user.click(screen.getByRole("radio", { name: "Datas exatas" }));
    // O calendário abre em janeiro de 2026; setembro fica 8 meses à frente.
    await user.click(screen.getByRole("button", { name: /Datas/ }));
    for (let i = 0; i < 8; i += 1) {
      await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    }
    await user.click(screen.getByRole("gridcell", { name: "10" }));
    await user.click(screen.getByRole("gridcell", { name: "17" }));
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));

    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      dateStart: "2026-09-10",
      dateEnd: "2026-09-17"
    });
  });

  it("o orçamento do slider chega no body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm onSubmit={onSubmit} />);
    await preencherPorMes(user);
    // input[type=range] não aceita type(); o evento de mudança é o caminho.
    fireEvent.change(screen.getByLabelText(/Orçamento total/), { target: { value: "20000" } });
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));
    expect(onSubmit.mock.calls[0]![0]!.budgetTotal).toBe(20_000);
  });

  it("os viajantes do stepper chegam no body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm onSubmit={onSubmit} />);
    await preencherPorMes(user);
    await user.click(screen.getByRole("button", { name: "Aumentar Crianças" }));
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));
    expect(onSubmit.mock.calls[0]![0]!.party).toEqual({ adults: 2, children: 1 });
  });

  it("dias de viagem e adultos chegam no body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm onSubmit={onSubmit} />);
    await preencherPorMes(user);
    await user.click(screen.getByRole("button", { name: "Aumentar Dias de viagem" }));
    await user.click(screen.getByRole("button", { name: "Diminuir Adultos" }));
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      durationDays: 8,
      party: { adults: 1, children: 0 }
    });
  });

  it("não chama onSubmit quando o formulário é enviado inválido", async () => {
    const onSubmit = vi.fn();
    const { container } = render(<DiscoveryForm onSubmit={onSubmit} />);
    container.querySelector("form")!.requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pending desabilita o envio", async () => {
    const user = userEvent.setup();
    render(<DiscoveryForm onSubmit={vi.fn()} pending />);
    await preencherPorMes(user);
    expect(screen.getByRole("button", { name: /Buscar destinos/ })).toBeDisabled();
  });

  it("oferece o atalho para ajustar os gostos", () => {
    render(<DiscoveryForm onSubmit={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Ajustar gostos" })).toHaveAttribute(
      "href",
      "/onboarding"
    );
  });


  // A sidebar de /trips/new espelha o formulário, então cada tecla precisa
  // chegar lá — não só o submit.
  it("avisa a cada mudança quem estiver ouvindo", async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(<DiscoveryForm onSubmit={vi.fn()} onStateChange={onStateChange} />);

    await user.type(screen.getByLabelText("Saindo de"), "GRU");

    expect(onStateChange).toHaveBeenCalled();
    expect(onStateChange.mock.calls.at(-1)![0]).toMatchObject({ originIata: "GRU" });
  });
});
