"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TripInput } from "@farol/shared";
import { AuthGate } from "../../../components/AuthGate";
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
    <main>
      <h1>Para onde vamos?</h1>
      <p>Me diz de onde você sai, quando e quanto dá para gastar. Eu acho o destino.</p>
      <DiscoveryForm onSubmit={(input) => void submit(input)} pending={pending} />
      {error !== null ? <p role="alert">{error}</p> : null}
    </main>
  );
}

export default function NewTripPage() {
  return <AuthGate>{(token) => <NewTrip token={token} />}</AuthGate>;
}
