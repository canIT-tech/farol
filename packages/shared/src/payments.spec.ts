import { describe, it, expect } from "vitest";
import {
  PRODUCTS,
  checkoutInputSchema,
  checkoutResultSchema,
  orderSummarySchema,
  paymentMeSchema,
  PaymentRequiredError,
  PaymentNotConfiguredError,
  isDomainError
} from "./index.js";

describe("PRODUCTS", () => {
  it("avulso é 1 crédito por R$ 39 e pacote 3 por R$ 89", () => {
    expect(PRODUCTS.single).toEqual({ credits: 1, amountCents: 3900, label: "1 viagem" });
    expect(PRODUCTS.pack3).toEqual({ credits: 3, amountCents: 8900, label: "3 viagens" });
  });
});

describe("checkoutInputSchema", () => {
  it("aceita single e pack3", () => {
    expect(checkoutInputSchema.parse({ product: "single" }).product).toBe("single");
    expect(checkoutInputSchema.parse({ product: "pack3" }).product).toBe("pack3");
  });

  it("recusa produto desconhecido", () => {
    expect(() => checkoutInputSchema.parse({ product: "pack10" })).toThrow();
  });
});

describe("checkoutResultSchema", () => {
  it("exige url válida", () => {
    expect(checkoutResultSchema.parse({ url: "https://checkout.stripe.com/x" }).url).toContain("stripe");
    expect(() => checkoutResultSchema.parse({ url: "nao-e-url" })).toThrow();
  });
});

describe("orderSummarySchema", () => {
  const order = {
    id: "11111111-1111-4111-8111-111111111111",
    product: "single",
    credits: 1,
    amountCents: 3900,
    status: "paid",
    createdAt: "2026-09-15T00:00:00.000Z"
  };

  it("aceita uma compra completa", () => {
    expect(orderSummarySchema.parse(order)).toEqual(order);
  });

  it("recusa status fora do ciclo", () => {
    expect(() => orderSummarySchema.parse({ ...order, status: "chargeback" })).toThrow();
  });

  it("recusa créditos e valor não positivos", () => {
    expect(() => orderSummarySchema.parse({ ...order, credits: 0 })).toThrow();
    expect(() => orderSummarySchema.parse({ ...order, amountCents: 0 })).toThrow();
  });
});

describe("paymentMeSchema", () => {
  it("aceita saldo zero e lista vazia", () => {
    expect(paymentMeSchema.parse({ credits: 0, freeItineraryUsed: false, orders: [] }).credits).toBe(0);
  });

  it("recusa saldo negativo", () => {
    expect(() =>
      paymentMeSchema.parse({ credits: -1, freeItineraryUsed: false, orders: [] })
    ).toThrow();
  });
});

describe("erros de pagamento", () => {
  it("PaymentRequiredError é DomainError com code payment_required", () => {
    const e = new PaymentRequiredError();
    expect(isDomainError(e)).toBe(true);
    expect(e.code).toBe("payment_required");
    expect(e.message).toContain("crédito");
  });

  it("PaymentNotConfiguredError tem code payment_not_configured", () => {
    const e = new PaymentNotConfiguredError();
    expect(isDomainError(e)).toBe(true);
    expect(e.code).toBe("payment_not_configured");
    expect(e.message).toContain("compra");
  });
});
