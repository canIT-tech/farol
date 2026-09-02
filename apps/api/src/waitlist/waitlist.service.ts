import { Inject, Injectable } from "@nestjs/common";
import type { WaitlistCount, WaitlistSignup, WaitlistSignupResult } from "@farol/shared";
import { EMAIL, type EmailPort } from "../email/email.types";
import { WaitlistRepository } from "./waitlist.repository";
import { welcomeEmail } from "./welcome-email";

@Injectable()
export class WaitlistService {
  constructor(
    private readonly repo: WaitlistRepository,
    @Inject(EMAIL) private readonly email: EmailPort
  ) {}

  async signup(input: WaitlistSignup): Promise<WaitlistSignupResult> {
    const created = await this.repo.add(input.email, input.source ?? null);
    if (created) {
      await this.sendWelcome(input.email);
    }
    return { ok: true, created };
  }

  async count(): Promise<WaitlistCount> {
    return { count: await this.repo.count() };
  }

  // Falha no e-mail não falha o cadastro: a linha fica com welcome_sent_at
  // nulo, e dá para reenviar depois.
  // ponytail: envio síncrono e sem retry; job do pg-boss se a Resend oscilar.
  private async sendWelcome(email: string): Promise<void> {
    try {
      await this.email.send(welcomeEmail(email));
      await this.repo.markWelcomeSent(email);
    } catch (err) {
      console.error(
        JSON.stringify({ event: "waitlist_welcome_failed", message: (err as Error).message })
      );
    }
  }
}
