"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { TripState } from "@farol/shared";
import { getTrip } from "../lib/trip-api";

export interface TripContextValue {
  trip: TripState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  token: string;
}

const TripContext = createContext<TripContextValue | null>(null);

export function useTrip(): TripContextValue {
  const value = useContext(TripContext);
  if (value === null) {
    throw new Error("useTrip precisa estar dentro de um TripProvider");
  }
  return value;
}

// Fonte única do TripState na área logada. Toda mutação (escolher destino,
// chat, selecionar voo/hotel) termina chamando refetch em vez de remendar o
// estado local — o back é quem sabe o que mudou.
export function TripProvider({
  tripId,
  token,
  children
}: {
  tripId: string;
  token: string;
  children: ReactNode;
}) {
  const [trip, setTrip] = useState<TripState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrip(await getTrip(token, tripId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "erro ao carregar a viagem");
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <TripContext.Provider value={{ trip, loading, error, refetch: load, token }}>
      {children}
    </TripContext.Provider>
  );
}
