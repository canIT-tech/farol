import type { EmailMessage, EmailPort } from "../email.types";

const ENDPOINT = "https://api.resend.com/emails";
// Resend costuma responder em centenas de ms; 8 s cobre uma degradação sem
// segurar o signup da waitlist indefinidamente.
const TIMEOUT_MS = 8_000;

// Resend por REST puro — sem SDK, é um POST.
export class ResendEmailProvider implements EmailPort {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`resend respondeu ${res.status}: ${detail}`);
    }
  }
}
