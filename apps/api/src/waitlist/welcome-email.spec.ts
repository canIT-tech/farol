import { describe, it, expect } from "vitest";
import { welcomeEmail } from "./welcome-email";

describe("welcomeEmail", () => {
  it("monta o e-mail de boas-vindas para o destinatário", () => {
    expect(welcomeEmail("ana@farol.app")).toEqual({
      to: "ana@farol.app",
      subject: "Você está na lista do Farol",
      text:
        "Oi,\n\nSeu e-mail entrou na lista de primeiros usuários do Farol — o assessor de viagem que parte do seu gosto, acha o destino e monta o dia a dia.\n\nVocê recebe um único e-mail quando o acesso abrir. Sem spam.\n\n— Farol"
    });
  });
});
