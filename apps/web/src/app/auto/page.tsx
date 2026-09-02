"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tasteProfileSchema } from "@farol/shared";
import { AuthGate } from "../../components/AuthGate";
import { AutoForm } from "../../components/auto/AutoForm";
import { apiFetch } from "../../lib/api-client";
import { bestCandidate, toAutoTasteProfile, toAutoTripInput, type AutoFormState } from "../../lib/auto-plan";
import { chooseDestination, createTrip, runDiscovery } from "../../lib/trip-api";

function Auto({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modo autônomo: mesma pipeline do fluxo padrão, sem a tela de escolha —
  // o melhor candidato é escolhido aqui e a pessoa ajusta pelo chat.
  async function submit(state: AutoFormState) {
    setPending(true);
    setError(null);
    try {
      await apiFetch({
        path: "/me/profile",
        schema: tasteProfileSchema,
        token,
        method: "PUT",
        body: toAutoTasteProfile(state)
      });
      const trip = await createTrip(token, toAutoTripInput(state)!);
      const best = bestCandidate(await runDiscovery(token, trip.id));
      if (best === null) {
        setError("não achei destino que caiba nesse orçamento");
        setPending(false);
        return;
      }
      await chooseDestination(token, trip.id, best.iata);
      router.push(`/trips/${trip.id}/itinerary`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui montar o plano");
      setPending(false);
    }
  }

  return (
    <main>
      <h1>Me diz o mínimo, eu monto o resto</h1>
      <p>Origem, datas, quanto dá para gastar e três gostos. Devolvo um plano fechado.</p>
      <AutoForm onSubmit={(state) => void submit(state)} pending={pending} />
      {error !== null ? <p role="alert">{error}</p> : null}
    </main>
  );
}

export default function AutoPage() {
  return <AuthGate>{(token) => <Auto token={token} />}</AuthGate>;
}
