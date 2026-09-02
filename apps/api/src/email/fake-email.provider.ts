import type { EmailMessage, EmailPort } from "./email.types";

// EMAIL_PROVIDER=fake: guarda em memória em vez de enviar. Para testes e para
// o E2E, que sobe a api como processo externo.
export class FakeEmailProvider implements EmailPort {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}
