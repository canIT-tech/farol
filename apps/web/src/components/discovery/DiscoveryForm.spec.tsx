import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DiscoveryForm } from "./DiscoveryForm";

// O DiscoveryForm chama /geo/whereami no mount. Sem este mock a suíte bateria
// na rede de verdade; os testes que se importam com a sugestão passam a prop.
vi.mock("../../lib/geo-api", () => ({
  whereami: vi.fn(() => Promise.resolve(null))
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

async function preencherPorMes(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Saindo de"), "gru");
  await user.type(screen.getByLabelText("Mês"), "2026-09");
}

describe("DiscoveryForm", () => {
  it("começa no modo mês, com dias de viagem", () => {
    render(<DiscoveryForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Mês")).toBeInTheDocument();
    expect(screen.getByLabelText("Dias de viagem")).toBeInTheDocument();
    expect(screen.queryByLabelText("Ida")).not.toBeInTheDocument();
  });

  it("o toggle troca para datas exatas", async () => {
    const user = userEvent.setup();
    render(<DiscoveryForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Datas exatas" }));
    expect(screen.getByLabelText("Ida")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mês")).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Ida"), "2026-09-10");
    await user.type(screen.getByLabelText("Volta"), "2026-09-17");
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
    fireEvent.change(screen.getByLabelText("Orçamento total"), { target: { value: "20000" } });
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

  it("sugere a origem detectada pelo IP e explica de onde veio", async () => {
    const detectOrigin = vi.fn(() =>
      Promise.resolve({
        iata: "XAP",
        name: "Chapeco",
        countryName: "Brazil",
        countryCode: "BR",
        lat: -27.1,
        lon: -52.6
      })
    );
    render(<DiscoveryForm onSubmit={vi.fn()} detectOrigin={detectOrigin} />);

    expect(await screen.findByText(/Sugeri Chapeco \(XAP\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Saindo de")).toHaveValue("XAP");
  });

  it("não sobrescreve a origem que a pessoa já digitou", async () => {
    const chapeco = {
      iata: "XAP",
      name: "Chapeco",
      countryName: "Brazil",
      countryCode: "BR",
      lat: -27.1,
      lon: -52.6
    };
    let resolveDetect: (value: typeof chapeco) => void = () => undefined;
    const detectOrigin = vi.fn(
      () =>
        new Promise<typeof chapeco>((resolve) => {
          resolveDetect = resolve;
        })
    );
    const user = userEvent.setup();
    render(<DiscoveryForm onSubmit={vi.fn()} detectOrigin={detectOrigin as never} />);

    const origin = screen.getByLabelText("Saindo de");
    await user.type(origin, "gig");
    resolveDetect(chapeco);

    // A sugestão aparece no hint, mas o campo continua com o que a pessoa pôs.
    expect(await screen.findByText(/Sugeri Chapeco \(XAP\)/)).toBeInTheDocument();
    expect(origin).toHaveValue("gig");
  });

  it("segue funcionando quando a detecção de origem falha", async () => {
    const detectOrigin = vi.fn(() => Promise.reject(new Error("503")));
    render(<DiscoveryForm onSubmit={vi.fn()} detectOrigin={detectOrigin as never} />);

    expect(await screen.findByLabelText("Saindo de")).toHaveValue("");
    expect(screen.getByText("Código IATA do aeroporto de origem")).toBeInTheDocument();
  });
});
