"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
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
    return (
      <section className="pane">
        <p className="pane__status" role="status">
          Procurando destinos…
        </p>
      </section>
    );
  }

  return (
    <section className="pane">
      <div className="pane__head">
        <h1 className="pane__title">
          {trip.destinations.length === 1
            ? "Achei 1 destino pra você"
            : `Achei ${trip.destinations.length} destinos pra você`}
        </h1>
      </div>
      <p className="pane__sub">
        Ordenados pelo quanto combinam com o seu gosto. Escolha um e eu monto o roteiro.
      </p>
      {error !== null ? (
        <div className="pane__error" role="alert">
          <span>{error}</span>
          <Button type="button" variant="ghost" onClick={() => void retry()} disabled={busy}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      <DestinationResults
        destinations={trip.destinations}
        onChoose={(iata) => void choose(iata)}
      />
    </section>
  );
}
