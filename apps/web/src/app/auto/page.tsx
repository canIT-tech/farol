"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./auto.css";
import { tasteProfileSchema } from "@farol/shared";
import { BrandHeader } from "../../components/common/BrandHeader";
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
    <main className="screen">
      <BrandHeader>
        <span className="screen__badge">Modo autônomo</span>
      </BrandHeader>

      <div className="screen__card">
        <h1 className="screen__title">
          Diga quando.
          <br />
          O resto é comigo.
        </h1>
        <p className="screen__sub">
          Farol escolhe o destino, monta o roteiro dia a dia e acha voo e hotel. Você recebe um
          plano fechado e ajusta o que quiser conversando — sem ficar comparando opções.
        </p>
        <AutoForm onSubmit={(state) => void submit(state)} pending={pending} />
        {error !== null ? (
          <p className="screen__error" role="alert">
            {error}
          </p>
        ) : (
          <p className="auto-reassure">
            Nada é reservado agora. Você revisa o plano inteiro antes de qualquer compra.
          </p>
        )}
      </div>
    </main>
  );
}

export default function AutoPage() {
  return <AuthGate>{(token) => <Auto token={token} />}</AuthGate>;
}
