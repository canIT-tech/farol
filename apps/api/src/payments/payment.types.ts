import { ValidationError, type ProductId } from "@farol/shared";

export const PAYMENT = Symbol("PAYMENT");

export interface CheckoutRequest {
  orderId: string;
  userId: string;
  email: string;
  product: ProductId;
  successUrl: string;
  cancelUrl: string;
}

// Evento de webhook já normalizado: o serviço só conhece estes quatro tipos.
// `paid` traz o payment_intent porque é ele que liga um charge.refunded à
// order depois — sem consultar a Stripe de novo.
export type PaymentEvent =
  | { id: string; type: "paid"; sessionId: string; paymentIntent: string | null }
  | { id: string; type: "expired"; sessionId: string }
  | { id: string; type: "refunded"; paymentIntent: string }
  | { id: string; type: "ignored" };

// Porta neutra de pagamento (spec 2026-09-15 §4). Mesmo desenho do LLM e do
// e-mail: existe para o `fake` dos testes, não como abstração de gateway.
export interface PaymentProvider {
  createCheckout(input: CheckoutRequest): Promise<{ url: string; sessionId: string }>;
  /** Lança PaymentSignatureError se a assinatura não bater. */
  parseWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent>;
}

// Assinatura que não bate é 400: quem manda assinatura errada não é a Stripe.
export class PaymentSignatureError extends ValidationError {
  constructor() {
    super("assinatura do webhook inválida");
  }
}
