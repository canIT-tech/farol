import {
  PaymentSignatureError,
  type CheckoutRequest,
  type PaymentEvent,
  type PaymentProvider
} from "./payment.types";

// Provider determinístico dos testes e do E2E: o "checkout" é a própria url
// de sucesso do app, e o "webhook" é o evento normalizado em JSON, assinado
// com a palavra "fake". Nada sai para a rede.
export class FakePaymentProvider implements PaymentProvider {
  async createCheckout(input: CheckoutRequest): Promise<{ url: string; sessionId: string }> {
    return { url: input.successUrl, sessionId: `fake_cs_${input.orderId}` };
  }

  async parseWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent> {
    if (signature !== "fake") {
      throw new PaymentSignatureError();
    }
    return JSON.parse(rawBody.toString("utf8")) as PaymentEvent;
  }
}
