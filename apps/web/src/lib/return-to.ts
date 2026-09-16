const KEY = "farol:returnTo";
const CREDITS_BEFORE_KEY = "farol:creditsBefore";
const DEFAULT = "/trips";

/** Só caminho relativo dentro do app: um `returnTo` vindo da query poderia
 *  apontar para fora (open redirect). */
export function safeReturnTo(value: string | null | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT;
  }
  return value;
}

// sessionStorage pode não existir ou lançar (navegação privada, iframe sem
// permissão); sem ele, o fluxo segue com os defaults.
function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Guarda para onde voltar depois do Checkout (a Stripe não leva estado). */
export function saveReturnTo(path: string | null | undefined): void {
  storage()?.setItem(KEY, safeReturnTo(path));
}

/** Lê e limpa o caminho de volta; sem valor, a casa da área logada. */
export function takeReturnTo(): string {
  const s = storage();
  const value = safeReturnTo(s?.getItem(KEY));
  s?.removeItem(KEY);
  return value;
}

/** Saldo antes de ir para a Stripe: é o que /payment/success compara. */
export function saveCreditsBefore(credits: number): void {
  storage()?.setItem(CREDITS_BEFORE_KEY, String(credits));
}

export function takeCreditsBefore(): number {
  const s = storage();
  const raw = s?.getItem(CREDITS_BEFORE_KEY);
  s?.removeItem(CREDITS_BEFORE_KEY);
  const n = Number(raw);
  return raw === null || raw === undefined || !Number.isInteger(n) || n < 0 ? 0 : n;
}
