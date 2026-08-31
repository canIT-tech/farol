import { Injectable } from "@nestjs/common";
import type { WaitlistCount, WaitlistSignup, WaitlistSignupResult } from "@farol/shared";
import { WaitlistRepository } from "./waitlist.repository";

@Injectable()
export class WaitlistService {
  constructor(private readonly repo: WaitlistRepository) {}

  async signup(input: WaitlistSignup): Promise<WaitlistSignupResult> {
    const created = await this.repo.add(input.email, input.source ?? null);
    return { ok: true, created };
  }

  async count(): Promise<WaitlistCount> {
    return { count: await this.repo.count() };
  }
}
