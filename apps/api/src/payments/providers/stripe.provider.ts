import Stripe from "stripe";
import type { ProductId } from "@farol/shared";
import type { Env } from "../../config/env.schema";
import {
  PaymentSignatureError,
  type CheckoutRequest,
  type PaymentEvent,
  type PaymentProvider
} from "../payment.types";

export interface StripeConfig {
  webhookSecret: string;
  prices: Record<ProductId, string>;
}

// Só o que o provider usa do SDK: deixa o teste passar um stub sem chave.
export interface StripeLike {
  checkout: { sessions: Pick<Stripe["checkout"]["sessions"], "create"> };
}

// Aparece na fatura do cartão junto do prefixo da conta ("ISTECH* FAROL").
const STATEMENT_SUFFIX = "FAROL";

function intentId(pi: string | Stripe.PaymentIntent | null | undefined): string | null {
  return typeof pi === "string" ? pi : (pi?.id ?? null);
}

// Traduz o evento da Stripe para o vocabulário do serviço (spec §4). Tudo que
// não é pagamento, expiração ou estorno vira `ignored` — e ainda assim é
// registrado em webhook_events, para o replay ser no-op.
export function normalizeStripeEvent(event: Stripe.Event): PaymentEvent {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      // Boleto/Pix confirmam depois: completed sem paid não credita nada.
      return session.payment_status === "paid"
        ? {
            id: event.id,
            type: "paid",
            sessionId: session.id,
            paymentIntent: intentId(session.payment_intent)
          }
        : { id: event.id, type: "ignored" };
    }
    case "checkout.session.expired":
      return { id: event.id, type: "expired", sessionId: event.data.object.id };
    case "charge.refunded": {
      const paymentIntent = intentId(event.data.object.payment_intent);
      return paymentIntent === null
        ? { id: event.id, type: "ignored" }
        : { id: event.id, type: "refunded", paymentIntent };
    }
    default:
      return { id: event.id, type: "ignored" };
  }
}

export class StripePaymentProvider implements PaymentProvider {
  constructor(
    private readonly stripe: StripeLike,
    private readonly config: StripeConfig
  ) {}

  // O superRefine do env.schema garante as quatro envs quando o provider é stripe.
  static fromEnv(env: Env): StripePaymentProvider {
    return new StripePaymentProvider(new Stripe(env.STRIPE_SECRET_KEY!), {
      webhookSecret: env.STRIPE_WEBHOOK_SECRET!,
      prices: { single: env.STRIPE_PRICE_SINGLE!, pack3: env.STRIPE_PRICE_PACK3! }
    });
  }

  async createCheckout(input: CheckoutRequest): Promise<{ url: string; sessionId: string }> {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: this.config.prices[input.product], quantity: 1 }],
      client_reference_id: input.userId,
      customer_email: input.email,
      metadata: { orderId: input.orderId },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      // O aceite dos Termos é registrado pela Stripe (data, IP) — exige a URL
      // cadastrada em Settings → Public details.
      consent_collection: { terms_of_service: "required" },
      payment_intent_data: { statement_descriptor_suffix: STATEMENT_SUFFIX }
    });
    if (!session.url) {
      throw new Error("a Stripe não devolveu a url do checkout");
    }
    return { url: session.url, sessionId: session.id };
  }

  async parseWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent> {
    let event: Stripe.Event;
    try {
      // Estático: não precisa de chave de API, só do signing secret.
      event = Stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    } catch {
      throw new PaymentSignatureError();
    }
    return normalizeStripeEvent(event);
  }
}
