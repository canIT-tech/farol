"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { tasteProfileSchema, type TasteProfileInput, type TripInput } from "@farol/shared";
import { AuthGate } from "../../../components/AuthGate";
import { ShellFrame } from "../../../components/TripShell";
import { DiscoveryForm } from "../../../components/discovery/DiscoveryForm";
import { createTrip, runDiscovery } from "../../../lib/trip-api";
import {
  EMPTY_DISCOVERY_FORM,
  defaultAdults,
  draftSummary,
  type DiscoveryFormState
} from "../../../lib/discovery-form";
import { apiFetch } from "../../../lib/api-client";

function NewTrip({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DiscoveryFormState>(EMPTY_DISCOVERY_FORM);
  const summary = useMemo(() => draftSummary(draft), [draft]);
  // A companhia do perfil já diz quantos vão: quem marcou "sozinho" não devia
  // ter que baixar o contador de 2 para 1 toda vez. Sem perfil, segue o padrão.
  const [party, setParty] = useState<TasteProfileInput["partyType"] | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch({ path: "/me/profile", schema: tasteProfileSchema, token })
      .then((profile) => {
        if (!cancelled) setParty(profile.partyType);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    <ShellFrame tripId={null} trip={summary} onNavigate={() => undefined}>
      <section className="pane">
        <p className="pane__eyebrow">Descoberta de destino</p>
        <div className="pane__head">
          <h1 className="pane__title">Vamos achar seu destino</h1>
        </div>
        <p className="pane__sub">
          Alguns detalhes e o assessor cruza com o seu perfil pra sugerir para onde ir.
        </p>
        <div className="pane__form">
          {ready ? (
          <DiscoveryForm
            token={token}
            adults={defaultAdults(party)}
            onSubmit={(input) => void submit(input)}
            onStateChange={setDraft}
            pending={pending}
          />
          ) : (
            <p className="pane__status" role="status">
              Carregando seu perfil…
            </p>
          )}
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
