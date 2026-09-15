import { z } from "zod";
import { DomainError } from "./errors.js";

// Pagamento por viagem (spec 2026-09-15, "modo Levels"): dois produtos, saldo
// em users.credits, histórico na Stripe. Catálogo é código, não tabela.
export const productIdSchema = z.enum(["single", "pack3"]);
export type ProductId = z.infer<typeof productIdSchema>;

export const PRODUCTS: Record<ProductId, { credits: number; amountCents: number; label: string }> = {
  single: { credits: 1, amountCents: 3900, label: "1 viagem" },
  pack3: { credits: 3, amountCents: 8900, label: "3 viagens" }
};

export const checkoutInputSchema = z.object({ product: productIdSchema });
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const checkoutResultSchema = z.object({ url: z.string().url() });
export type CheckoutResult = z.infer<typeof checkoutResultSchema>;

export const orderStatusSchema = z.enum(["pending", "paid", "expired", "refunded"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSummarySchema = z.object({
  id: z.string().uuid(),
  product: productIdSchema,
  credits: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  status: orderStatusSchema,
  createdAt: z.string().min(1)
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

// O que o web lê para o selo do header e para o polling depois do checkout.
export const paymentMeSchema = z.object({
  credits: z.number().int().min(0),
  freeItineraryUsed: z.boolean(),
  orders: z.array(orderSummarySchema)
});
export type PaymentMe = z.infer<typeof paymentMeSchema>;

// 402: o roteiro grátis da conta já foi usado e não há saldo.
export class PaymentRequiredError extends DomainError {
  constructor() {
    super(
      "payment_required",
      "sua primeira viagem foi por nossa conta — as próximas usam um crédito"
    );
  }
}

// 503: PAYMENT_PROVIDER ausente. O gate segue funcionando; só a compra não existe.
export class PaymentNotConfiguredError extends DomainError {
  constructor() {
    super("payment_not_configured", "a compra de créditos ainda não está disponível");
  }
}
