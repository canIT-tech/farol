import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvisorChat, type ChatMessage } from "./AdvisorChat";

afterEach(cleanup);

const msgs: ChatMessage[] = [
  { id: "1", role: "assistant", content: "Montei 7 dias." },
  { id: "2", role: "user", content: "tira o museu" }
];

describe("AdvisorChat", () => {
  it("renderiza as bolhas com a classe por role", () => {
    render(<AdvisorChat messages={msgs} onSend={() => {}} />);
    expect(screen.getByText("Montei 7 dias.").className).toContain("farol-chat__bubble--assistant");
    expect(screen.getByText("tira o museu").className).toContain("farol-chat__bubble--user");
  });

  it("digitar + Enter chama onSend com o texto e limpa o input", async () => {
    const onSend = vi.fn();
    render(<AdvisorChat messages={msgs} onSend={onSend} />);
    const input = screen.getByLabelText("Mensagem para o assessor");
    await userEvent.type(input, "  mais praia  {Enter}");
    expect(onSend).toHaveBeenCalledWith("mais praia");
    expect(input).toHaveValue("");
  });

  it("Shift+Enter não envia", async () => {
    const onSend = vi.fn();
    render(<AdvisorChat messages={msgs} onSend={onSend} />);
    const input = screen.getByLabelText("Mensagem para o assessor");
    await userEvent.type(input, "linha 1{Shift>}{Enter}{/Shift}linha 2");
    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue("linha 1\nlinha 2");
  });

  it("botão enviar desabilitado com input vazio ou só espaços", async () => {
    const onSend = vi.fn();
    render(<AdvisorChat messages={msgs} onSend={onSend} />);
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Mensagem para o assessor"), "   ");
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Mensagem para o assessor"), "oi");
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(onSend).toHaveBeenCalledWith("oi");
  });

  it("pending desabilita o input, esconde o send e mostra o indicador", () => {
    render(<AdvisorChat messages={msgs} onSend={() => {}} pending />);
    expect(screen.getByLabelText("Mensagem para o assessor")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(screen.getByLabelText("Assessor está respondendo")).toBeInTheDocument();
  });

  it("Enter durante pending não envia", async () => {
    const onSend = vi.fn();
    render(<AdvisorChat messages={msgs} onSend={onSend} pending />);
    const input = screen.getByLabelText("Mensagem para o assessor");
    await userEvent.type(input, "x{Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("usa o placeholder padrão e o customizado", () => {
    const { rerender } = render(<AdvisorChat messages={msgs} onSend={() => {}} />);
    expect(screen.getByPlaceholderText("Peça um ajuste…")).toBeInTheDocument();
    rerender(<AdvisorChat messages={msgs} onSend={() => {}} placeholder="Fale com o Farol" />);
    expect(screen.getByPlaceholderText("Fale com o Farol")).toBeInTheDocument();
  });

  it("a lista é um log com aria-live", () => {
    render(<AdvisorChat messages={msgs} onSend={() => {}} />);
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
  });
});
