import {
  checkoutResultSchema,
  paymentMeSchema,
  type CheckoutResult,
  type PaymentMe,
  type ProductId
} from "@farol/shared";
import { apiFetch } from "./api-client";

/** Saldo, se o roteiro grátis já foi usado, e as compras. É o que o selo do
 *  header lê e o que /pagamento/sucesso consulta até o crédito aparecer. */
export function getPaymentMe(token: string, f?: typeof fetch): Promise<PaymentMe> {
  return apiFetch({ path: "/payments/me", schema: paymentMeSchema, token }, f);
}

/** Abre a compra: a api cria a order e devolve a url do Checkout da Stripe. */
export function startCheckout(
  token: string,
  product: ProductId,
  f?: typeof fetch
): Promise<CheckoutResult> {
  return apiFetch(
    { path: "/payments/checkout", schema: checkoutResultSchema, token, method: "POST", body: { product } },
    f
  );
}
