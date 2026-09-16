"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
import { partyLabel } from "../../../../components/TripSidebar";
import { DestinationResults } from "../../../../components/discovery/DestinationResults";
import { useTrip } from "../../../../providers/TripProvider";
import { chooseDestination, runDiscovery } from "../../../../lib/trip-api";
import { creditsRoute, isPaymentRequired } from "../../../../lib/payment-required";

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
      // Sem crédito não é erro: é a tela de compra, que volta para cá depois.
      if (isPaymentRequired(cause)) {
        router.push(creditsRoute(`/trips/${id}/discovery`));
        return;
      }
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
        <div>
          <h1 className="pane__title">
            {trip.destinations.length === 1
              ? "1 destino pra você"
              : `${trip.destinations.length} destinos pra você`}
          </h1>
          <p className="pane__sub pane__sub--tight">
            Ordenados por aderência ao seu perfil. Custo = voo + hospedagem + gastos locais, para{" "}
            {partyLabel(trip.party)}.
          </p>
        </div>
      </div>
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
