"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./auto.css";
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
    <main className="auto-page">
      <header className="auto-top">
        <div className="auto-logo">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 43h14" />
            <path d="M19.5 43 L21.5 25 h5 l2 18" />
            <path d="M20.5 25 h7" />
            <rect x="20.5" y="18" width="7" height="7" rx="1.2" />
            <path d="M22 18 h4 l-1 -3 h-2 z" />
          </svg>
          Farol
        </div>
        <span className="auto-mode">Modo autônomo</span>
      </header>

      <div className="auto-card">
        <h1 className="auto-title">
          Diga quando.
          <br />
          O resto é comigo.
        </h1>
        <p className="auto-sub">
          Farol escolhe o destino, monta o roteiro dia a dia e acha voo e hotel. Você recebe um
          plano fechado e ajusta o que quiser conversando — sem ficar comparando opções.
        </p>
        <AutoForm onSubmit={(state) => void submit(state)} pending={pending} />
        {error !== null ? (
          <p className="auto-error" role="alert">
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
