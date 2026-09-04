"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Itinerary } from "@farol/shared";
import { getItinerary } from "../lib/trip-api";

export const POLL_MS = 3_000;

/** Quanto tempo esperar antes de admitir que travou.
 *  A tela promete "menos de um minuto"; dois minutos é folga suficiente para um
 *  roteiro lento e curto o bastante para não deixar ninguém olhando um spinner
 *  que nunca vai terminar. */
export const POLL_TIMEOUT_MS = 120_000;

export interface ItineraryPolling {
  itinerary: Itinerary | null;
  loading: boolean;
  error: string | null;
  /** Passou do limite e o roteiro continua pendente — provavelmente o job não
   *  está sendo consumido (worker fora do ar, fila parada). */
  stalled: boolean;
  refetch: () => Promise<void>;
}

// A geração roda em job (pg-boss), então o GET devolve status "pending" até o
// worker terminar. Enquanto pendente, repergunta; para em ready, failed — ou
// quando estoura o limite.
//
// O limite existe porque "pending" também é o que se vê quando ninguém consome
// a fila: o job fica parado, o status nunca muda e a tela repergunta para
// sempre, prometendo um minuto que não chega. Já aconteceu em dev, com o
// processo do worker morto sem que nada acusasse.
export function useItineraryPolling(token: string, tripId: string): ItineraryPolling {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Marco de início da espera, num ref: entra na conta do limite sem reiniciar
  // o efeito de polling a cada resposta.
  const waitingSince = useRef<number>(Date.now());

  const load = useCallback(async () => {
    try {
      const next = await getItinerary(token, tripId);
      setItinerary(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "erro ao carregar o roteiro");
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  /** Pergunta de novo e reabre a janela de espera — é o que o botão da tela faz. */
  const refetch = useCallback(async () => {
    waitingSince.current = Date.now();
    setStalled(false);
    await load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (itinerary?.status !== "pending") {
      // Chegou ao fim: se tinha avisado que travou, o aviso sai junto.
      setStalled(false);
      return;
    }
    if (Date.now() - waitingSince.current >= POLL_TIMEOUT_MS) {
      setStalled(true);
      return;
    }
    timer.current = setTimeout(() => void load(), POLL_MS);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, [itinerary, load]);

  return { itinerary, loading, error, stalled, refetch };
}
