"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { DestinationResults } from "../../../../components/discovery/DestinationResults";
import { useTrip } from "../../../../providers/TripProvider";
import { chooseDestination, runDiscovery } from "../../../../lib/trip-api";

export default function DiscoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { trip, loading, token, refetch } = useTrip();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await runDiscovery(token, id);
      await refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui buscar destinos");
    } finally {
      setBusy(false);
    }
  }

  async function choose(iata: string) {
    setBusy(true);
    setError(null);
    try {
      await chooseDestination(token, id, iata);
      router.push(`/trips/${id}/itinerary`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui escolher o destino");
      setBusy(false);
    }
  }

  if (loading || trip === null) {
    return <p role="status">Procurando destinos…</p>;
  }

  return (
    <section>
      <h1>Achei estes destinos</h1>
      {error !== null ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void retry()} disabled={busy}>
            Tentar de novo
          </button>
        </div>
      ) : null}
      <DestinationResults
        destinations={trip.destinations}
        onChoose={(iata) => void choose(iata)}
      />
    </section>
  );
}
