import { describe, it, expect, vi } from "vitest";
import Stripe from "stripe";
import { PaymentSignatureError } from "../payment.types";
import { StripePaymentProvider, normalizeStripeEvent } from "./stripe.provider";

const secret = "whsec_test_farol";
const config = { webhookSecret: secret, prices: { single: "price_s", pack3: "price_p" } };

// Payload assinado do jeito que a Stripe assina, sem rede: a lib expõe o
// gerador de header de teste exatamente para isso.
function signed(payload: object): { body: Buffer; sig: string } {
  const body = JSON.stringify(payload);
  return {
    body: Buffer.from(body),
    sig: Stripe.webhooks.generateTestHeaderString({ payload: body, secret })
  };
}

function providerWith(create = vi.fn()) {
  return new StripePaymentProvider({ checkout: { sessions: { create } } } as never, config);
}

const checkoutInput = {
  orderId: "o-1",
  userId: "u-1",
  email: "e@farol.test",
  product: "pack3" as const,
  successUrl: "http://app/ok",
  cancelUrl: "http://app/no"
};

describe("StripePaymentProvider.createCheckout", () => {
  it("monta a Session com price, metadata, consent e descriptor", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/x" });
    const result = await providerWith(create).createCheckout(checkoutInput);

    expect(result).toEqual({ url: "https://checkout.stripe.com/x", sessionId: "cs_1" });
    expect(create).toHaveBeenCalledWith({
      mode: "payment",
      line_items: [{ price: "price_p", quantity: 1 }],
      client_reference_id: "u-1",
      customer_email: "e@farol.test",
      metadata: { orderId: "o-1" },
      success_url: "http://app/ok",
      cancel_url: "http://app/no",
      consent_collection: { terms_of_service: "required" },
      payment_intent_data: { statement_descriptor_suffix: "FAROL" }
    });
  });

  it("usa o price do avulso para single", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_2", url: "https://checkout.stripe.com/y" });
    await providerWith(create).createCheckout({ ...checkoutInput, product: "single" });
    expect(create.mock.calls[0]![0].line_items).toEqual([{ price: "price_s", quantity: 1 }]);
  });

  it("session sem url é erro — a Stripe pode devolver null", async () => {
    const create = vi.fn().mockResolvedValue({ id: "cs_3", url: null });
    await expect(providerWith(create).createCheckout(checkoutInput)).rejects.toThrow(/url do checkout/);
  });

  it("fromEnv monta o provider com as envs da Stripe", () => {
    const provider = StripePaymentProvider.fromEnv({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: secret,
      STRIPE_PRICE_SINGLE: "price_s",
      STRIPE_PRICE_PACK3: "price_p"
    } as never);
    expect(provider).toBeInstanceOf(StripePaymentProvider);
  });
});

describe("StripePaymentProvider.parseWebhook", () => {
  const provider = providerWith();

  it("checkout.session.completed pago vira paid com o payment_intent", async () => {
    const { body, sig } = signed({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1" } }
    });
    await expect(provider.parseWebhook(body, sig)).resolves.toEqual({
      id: "evt_1",
      type: "paid",
      sessionId: "cs_1",
      paymentIntent: "pi_1"
    });
  });

  it("completed ainda não pago (boleto pendente) é ignored", async () => {
    const { body, sig } = signed({
      id: "evt_2",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "unpaid", payment_intent: null } }
    });
    await expect(provider.parseWebhook(body, sig)).resolves.toEqual({ id: "evt_2", type: "ignored" });
  });

  it("checkout.session.expired vira expired", async () => {
    const { body, sig } = signed({
      id: "evt_3",
      type: "checkout.session.expired",
      data: { object: { id: "cs_9" } }
    });
    await expect(provider.parseWebhook(body, sig)).resolves.toEqual({
      id: "evt_3",
      type: "expired",
      sessionId: "cs_9"
    });
  });

  it("charge.refunded vira refunded com o payment_intent", async () => {
    const { body, sig } = signed({
      id: "evt_4",
      type: "charge.refunded",
      data: { object: { id: "ch_1", payment_intent: "pi_1" } }
    });
    await expect(provider.parseWebhook(body, sig)).resolves.toEqual({
      id: "evt_4",
      type: "refunded",
      paymentIntent: "pi_1"
    });
  });

  it("charge.refunded sem payment_intent é ignored", async () => {
    const { body, sig } = signed({
      id: "evt_5",
      type: "charge.refunded",
      data: { object: { id: "ch_2", payment_intent: null } }
    });
    await expect(provider.parseWebhook(body, sig)).resolves.toEqual({ id: "evt_5", type: "ignored" });
  });

  it("evento fora do vocabulário é ignored", async () => {
    const { body, sig } = signed({ id: "evt_6", type: "customer.created", data: { object: {} } });
    await expect(provider.parseWebhook(body, sig)).resolves.toEqual({ id: "evt_6", type: "ignored" });
  });

  it("assinatura inválida lança PaymentSignatureError", async () => {
    const { body } = signed({ id: "evt_7", type: "checkout.session.expired", data: { object: { id: "x" } } });
    await expect(provider.parseWebhook(body, "t=1,v1=errado")).rejects.toBeInstanceOf(
      PaymentSignatureError
    );
  });
});

describe("normalizeStripeEvent", () => {
  it("lê o id quando o payment_intent vem expandido como objeto", () => {
    const event = {
      id: "evt_8",
      type: "checkout.session.completed",
      data: { object: { id: "cs_8", payment_status: "paid", payment_intent: { id: "pi_8" } } }
    } as unknown as Stripe.Event;
    expect(normalizeStripeEvent(event)).toEqual({
      id: "evt_8",
      type: "paid",
      sessionId: "cs_8",
      paymentIntent: "pi_8"
    });
  });
});
