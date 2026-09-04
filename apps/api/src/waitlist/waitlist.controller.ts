import { Body, Controller, Get, Post } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import {
  waitlistSignupSchema,
  type WaitlistCount,
  type WaitlistSignup,
  type WaitlistSignupResult
} from "@farol/shared";
import { ZodValidationPipe } from "../common/zod.pipe";
import { WaitlistService } from "./waitlist.service";

// Rotas públicas: alimentam a landing pré-lançamento, antes de existir conta.
@Public()
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
