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

// Os seletores abrem no mês corrente e barram o passado, então as datas destes
// testes saem do relógio em vez de literais. A versão antiga cravava "2026-09"
// e "set", e quebraria sozinha na virada do mês.
const ANO_QUE_VEM = new Date().getUTCFullYear() + 1;
const JANEIRO_QUE_VEM = `${ANO_QUE_VEM}-01`;

const PROXIMO_MES = (() => {
  const agora = new Date();
  const ym = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 7);
  return { ida: `${ym}-10`, volta: `${ym}-17` };
})();

async function preencherPorMes(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Saindo de"), "gru");
  // Avança um ano: a grade inteira fica disponível, sem depender de qual mês é
  // hoje.
  await user.click(screen.getByRole("button", { name: /^Mês/ }));
  await user.click(screen.getByRole("button", { name: "Próximo ano" }));
  await user.click(screen.getByRole("button", { name: "jan" }));
}

describe("DiscoveryForm", () => {
  it("começa no modo mês, com dias de viagem", () => {
    render(<DiscoveryForm token="t" onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^Mês/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Dias de viagem")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Datas/ })).not.toBeInTheDocument();
  });

  it("o toggle troca para datas exatas", async () => {
    const user = userEvent.setup();
    render(<DiscoveryForm token="t" onSubmit={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Datas exatas" }));
    expect(screen.getByRole("button", { name: /Datas/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Mês/ })).not.toBeInTheDocument();
  });

  it("submit fica bloqueado enquanto o input não é válido", () => {
    render(<DiscoveryForm token="t" onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Buscar destinos/ })).toBeDisabled();
  });

  it("submit válido no modo mês manda o body do tripInputSchema", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm token="t" onSubmit={onSubmit} />);
    await preencherPorMes(user);
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      originIata: "GRU",
      targetMonth: JANEIRO_QUE_VEM,
      durationDays: 7,
      party: { adults: 2, children: 0 }
    });
  });

  it("submit válido no modo datas manda as datas", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm token="t" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Saindo de"), "GRU");
    await user.click(screen.getByRole("radio", { name: "Datas exatas" }));
    // Um mês à frente: o mês inteiro disponível, sem depender do dia de hoje.
    await user.click(screen.getByRole("button", { name: /Datas/ }));
    await user.click(screen.getByRole("button", { name: "Próximo mês" }));
    await user.click(screen.getByRole("gridcell", { name: "10" }));
    await user.click(screen.getByRole("gridcell", { name: "17" }));
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));

    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      dateStart: PROXIMO_MES.ida,
      dateEnd: PROXIMO_MES.volta
    });
  });

  it("o orçamento do slider chega no body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm token="t" onSubmit={onSubmit} />);
    await preencherPorMes(user);
    // input[type=range] não aceita type(); o evento de mudança é o caminho.
    fireEvent.change(screen.getByLabelText(/Orçamento total/), { target: { value: "20000" } });
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));
    expect(onSubmit.mock.calls[0]![0]!.budgetTotal).toBe(20_000);
  });

  it("os viajantes do stepper chegam no body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm token="t" onSubmit={onSubmit} />);
    await preencherPorMes(user);
    await user.click(screen.getByRole("button", { name: "Aumentar Crianças" }));
    await user.click(screen.getByRole("button", { name: /Buscar destinos/ }));
    expect(onSubmit.mock.calls[0]![0]!.party).toEqual({ adults: 2, children: 1 });
  });

  it("dias de viagem e adultos chegam no body", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DiscoveryForm token="t" onSubmit={onSubmit} />);
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
    const { container } = render(<DiscoveryForm token="t" onSubmit={onSubmit} />);
    container.querySelector("form")!.requestSubmit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("pending desabilita o envio", async () => {
    const user = userEvent.setup();
    render(<DiscoveryForm token="t" onSubmit={vi.fn()} pending />);
    await preencherPorMes(user);
    expect(screen.getByRole("button", { name: /Buscar destinos/ })).toBeDisabled();
  });

  it("oferece o atalho para ajustar os gostos", () => {
    render(<DiscoveryForm token="t" onSubmit={vi.fn()} />);
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
    render(<DiscoveryForm token="t" onSubmit={vi.fn()} onStateChange={onStateChange} />);

    await user.type(screen.getByLabelText("Saindo de"), "GRU");

    expect(onStateChange).toHaveBeenCalled();
    expect(onStateChange.mock.calls.at(-1)![0]).toMatchObject({ originIata: "GRU" });
  });
});
