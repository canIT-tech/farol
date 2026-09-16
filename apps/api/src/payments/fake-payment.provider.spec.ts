import { describe, it, expect } from "vitest";
import { FakePaymentProvider } from "./fake-payment.provider";
import { PaymentSignatureError } from "./payment.types";

const provider = new FakePaymentProvider();

describe("FakePaymentProvider", () => {
  it("createCheckout devolve a url de sucesso do app e um sessionId previsível", async () => {
    const result = await provider.createCheckout({
      orderId: "o-1",
      userId: "u-1",
      email: "e@farol.test",
      product: "single",
      successUrl: "http://app/pagamento/sucesso",
      cancelUrl: "http://app/pagamento/cancelado"
    });
    expect(result).toEqual({ url: "http://app/pagamento/sucesso", sessionId: "fake_cs_o-1" });
  });

  it("parseWebhook aceita JSON assinado com 'fake'", async () => {
    const event = { id: "evt_1", type: "paid", sessionId: "fake_cs_o-1", paymentIntent: null };
    const body = Buffer.from(JSON.stringify(event));
    await expect(provider.parseWebhook(body, "fake")).resolves.toEqual(event);
  });

  it("parseWebhook recusa qualquer outra assinatura", async () => {
    const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "ignored" }));
    await expect(provider.parseWebhook(body, "nope")).rejects.toBeInstanceOf(PaymentSignatureError);
  });
});
