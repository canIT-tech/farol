import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  waitlistSignupSchema,
  type WaitlistCount,
  type WaitlistSignup,
  type WaitlistSignupResult
} from "@farol/shared";
import { ZodValidationPipe } from "../common/zod.pipe";
import { WaitlistService } from "./waitlist.service";

// Rotas públicas — sem AuthGuard. Alimentam a landing pré-lançamento.
@Controller("waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  signup(
    @Body(new ZodValidationPipe(waitlistSignupSchema)) body: WaitlistSignup
  ): Promise<WaitlistSignupResult> {
    return this.waitlist.signup(body);
  }

  @Get("count")
  count(): Promise<WaitlistCount> {
    return this.waitlist.count();
  }
}
