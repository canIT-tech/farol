import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest
} from "@nestjs/common";
import {
  checkoutInputSchema,
  type CheckoutInput,
  type CheckoutResult,
  type CurrentUser as CurrentUserType,
  type PaymentMe
} from "@farol/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("checkout")
  @HttpCode(201)
  checkout(
    @CurrentUser() user: CurrentUserType,
    @Body(new ZodValidationPipe(checkoutInputSchema)) body: CheckoutInput
  ): Promise<CheckoutResult> {
    return this.payments.checkout(user, body.product);
  }

  @Get("me")
  me(@CurrentUser() user: CurrentUserType): Promise<PaymentMe> {
    return this.payments.me(user.id);
  }

  // Público: quem chama é a Stripe, e a credencial é a assinatura do corpo
  // cru (main.ts sobe com rawBody: true). Responde 200 depois de registrar o
  // evento; reenviar em 4xx/5xx não ajudaria.
  @Public()
  @Post("webhook")
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<object>,
    @Headers("stripe-signature") signature = ""
  ): Promise<{ received: true }> {
    await this.payments.applyWebhook(req.rawBody ?? Buffer.alloc(0), signature);
    return { received: true };
  }
}
