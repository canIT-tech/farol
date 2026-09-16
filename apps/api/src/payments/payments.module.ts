import { Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { FakePaymentProvider } from "./fake-payment.provider";
import { PAYMENT, type PaymentProvider } from "./payment.types";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { StripePaymentProvider } from "./providers/stripe.provider";

// Único lugar que conhece os providers de pagamento. Sem PAYMENT_PROVIDER a
// compra responde payment_not_configured e a aplicação sobe igual — o gate
// do roteiro (1º grátis, depois 402) não depende disto.
export function buildPayment(env: Env): PaymentProvider | null {
  if (env.PAYMENT_PROVIDER === "fake") {
    return new FakePaymentProvider();
  }
  if (env.PAYMENT_PROVIDER === undefined) {
    return null;
  }
  return StripePaymentProvider.fromEnv(env);
}

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT, inject: [ENV], useFactory: (env: Env) => buildPayment(env) }
  ]
})
export class PaymentsModule {}
