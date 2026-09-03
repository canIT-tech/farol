"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TripInput } from "@farol/shared";
import { AuthGate } from "../../../components/AuthGate";
import { ShellFrame } from "../../../components/TripShell";
import { DiscoveryForm } from "../../../components/discovery/DiscoveryForm";
import { createTrip, runDiscovery } from "../../../lib/trip-api";

function NewTrip({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(input: TripInput) {
    setPending(true);
    setError(null);
    try {
      const trip = await createTrip(token, input);
      await runDiscovery(token, trip.id);
      router.push(`/trips/${trip.id}/discovery`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui buscar destinos");
      setPending(false);
    }
  }

  return (
    <ShellFrame tripId={null} trip={null} onNavigate={() => undefined}>
      <section className="pane">
        <p className="pane__eyebrow">Descoberta de destino</p>
        <div className="pane__head">
          <h1 className="pane__title">Vamos achar seu destino</h1>
        </div>
        <p className="pane__sub">
          Alguns detalhes e o assessor cruza com o seu perfil pra sugerir para onde ir.
        </p>
        <div className="pane__form">
          <DiscoveryForm onSubmit={(input) => void submit(input)} pending={pending} />
          {error !== null ? (
            <p className="screen__error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </ShellFrame>
  );
}

export default function NewTripPage() {
  return <AuthGate>{(token) => <NewTrip token={token} />}</AuthGate>;
}
