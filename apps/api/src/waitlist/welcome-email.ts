import type { EmailMessage } from "../email/email.types";

// Único e-mail da waitlist. Voz da marca: específico, sem euforia
// (docs/design/brand/Voice.dc.html).
export function welcomeEmail(to: string): EmailMessage {
  return {
    to,
    subject: "Você está na lista do Farol",
    text: [
      "Oi,",
      "",
      "Seu e-mail entrou na lista de primeiros usuários do Farol — o assessor de viagem que parte do seu gosto, acha o destino e monta o dia a dia.",
      "",
      "Você recebe um único e-mail quando o acesso abrir. Sem spam.",
      "",
      "— Farol"
    ].join("\n")
  };
}
