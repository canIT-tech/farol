export const EMAIL = Symbol("EMAIL");

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

// Porta neutra de e-mail transacional. Mesmo desenho do LLM (design
// 2026-08-31): a aplicação fala só com a porta; qual provider responde é env.
export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}
