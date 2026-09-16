import { describe, it, expect } from "vitest";
import type { Env } from "../config/env.schema";
import { buildPayment } from "./payments.module";
import { FakePaymentProvider } from "./fake-payment.provider";
import { StripePaymentProvider } from "./providers/stripe.provider";

describe("buildPayment", () => {
  it("sem PAYMENT_PROVIDER devolve null — a compra fica desligada", () => {
    expect(buildPayment({} as Env)).toBeNull();
  });

  it("fake devolve o provider determinístico", () => {
    expect(buildPayment({ PAYMENT_PROVIDER: "fake" } as Env)).toBeInstanceOf(FakePaymentProvider);
  });

  it("stripe devolve o adapter da Stripe", () => {
    const env = {
      PAYMENT_PROVIDER: "stripe",
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_PRICE_SINGLE: "price_s",
      STRIPE_PRICE_PACK3: "price_p"
    } as Env;
    expect(buildPayment(env)).toBeInstanceOf(StripePaymentProvider);
  });
});
