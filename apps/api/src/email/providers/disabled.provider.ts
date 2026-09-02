import { DomainError } from "@farol/shared";
import type { EmailPort } from "../email.types";

const MESSAGE =
  "envio de e-mail não está configurado neste ambiente (defina EMAIL_PROVIDER, EMAIL_API_KEY e EMAIL_FROM)";

// Sem env de e-mail a aplicação sobe igual; quem tenta enviar recebe erro
// e decide o que fazer (a waitlist só registra e segue).
export class DisabledEmailProvider implements EmailPort {
  send(): Promise<void> {
    return Promise.reject(new DomainError("email_not_configured", MESSAGE));
  }
}
