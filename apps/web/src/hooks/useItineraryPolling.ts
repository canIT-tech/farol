"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Itinerary } from "@farol/shared";
import { getItinerary } from "../lib/trip-api";

export const POLL_MS = 3_000;

export interface ItineraryPolling {
  itinerary: Itinerary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// A geração roda em job (pg-boss), então o GET devolve status "pending" até o
// worker terminar. Enquanto pendente, repergunta; para em ready ou failed.
export function useItineraryPolling(token: string, tripId: string): ItineraryPolling {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (itinerary?.status !== "pending") {
      return;
    }
    timer.current = setTimeout(() => void load(), POLL_MS);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, [itinerary, load]);

  return { itinerary, loading, error, refetch: load };
}
