import { ApiError } from "./api-client";

const PAYMENT_REQUIRED = 402;

/** A api recusou por falta de crédito (spec pagamento §7): não é erro para
 *  mostrar, é convite para a tela de compra. */
export function isPaymentRequired(cause: unknown): boolean {
  return cause instanceof ApiError && cause.status === PAYMENT_REQUIRED;
}

/** Caminho da tela de compra, lembrando para onde voltar depois. */
export function creditsRoute(returnTo: string): string {
  return `/creditos?returnTo=${encodeURIComponent(returnTo)}`;
}
