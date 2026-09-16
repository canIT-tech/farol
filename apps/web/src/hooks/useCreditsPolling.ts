"use client";

import { useEffect, useState } from "react";
import { getPaymentMe } from "../lib/payments-api";

export type PollingState = "waiting" | "done" | "timeout";

export const POLL_EVERY_MS = 2000;
export const POLL_TIMEOUT_MS = 60_000;

/** Depois do Checkout, o crédito chega pelo webhook — que pode demorar mais
 *  que o redirect. Consulta o saldo até ele subir acima do que era antes, ou
 *  desiste depois de um minuto (o crédito chega de qualquer jeito). */
export function useCreditsPolling(token: string, baseline: number): PollingState {
  const [state, setState] = useState<PollingState>("waiting");

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();

    async function tick() {
      if (cancelled) return;
      try {
        const me = await getPaymentMe(token);
        if (cancelled) return;
        if (me.credits > baseline) {
          setState("done");
          return;
        }
      } catch {
        // tenta de novo no próximo tick
      }
      if (Date.now() - started >= POLL_TIMEOUT_MS) {
        setState("timeout");
        return;
      }
      timer = setTimeout(() => void tick(), POLL_EVERY_MS);
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    void tick();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [token, baseline]);

  return state;
}
