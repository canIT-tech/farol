"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tasteProfileSchema, type Trip } from "@farol/shared";
import { AuthGate } from "../../components/AuthGate";
import { budgetLabel, partyLabel, periodLabel } from "../../components/TripSidebar";
import { apiFetch } from "../../lib/api-client";
import { signOut } from "../../lib/session";
import { tripCardTitle, tripResumeRoute } from "../../lib/trip-home";
import { listTrips } from "../../lib/trip-api";

const STATUS_LABEL: Record<Trip["status"], string> = {
  draft: "em montagem",
  planned: "planejada",
  done: "concluída"
};

// Casa da área logada: as viagens da pessoa e as portas de entrada (nova viagem,
// modo autônomo, perfil, sair). Sem perfil de gosto ainda não há o que listar —
// vai direto para o onboarding, que volta para cá ao salvar.
function Home({ token }: { token: string }) {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await apiFetch({ path: "/me/profile", schema: tasteProfileSchema, token });
      } catch (cause) {
        if (cause instanceof Error && cause.message.endsWith("404")) {
          router.replace("/onboarding");
          return;
        }
        if (!cancelled) setError(cause instanceof Error ? cause.message : "erro ao carregar o perfil");
        return;
      }
      try {
        const list = await listTrips(token);
        if (!cancelled) setTrips(list);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "erro ao listar as viagens");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  async function leave() {
    await signOut();
    router.replace("/");
  }

  return (
    <main>
      <header>
        <h1>Minhas viagens</h1>
        <nav aria-label="Ações">
          <button type="button" onClick={() => router.push("/trips/new")}>
            Nova viagem
          </button>
          <button type="button" onClick={() => router.push("/auto")}>
            Modo autônomo
          </button>
          <button type="button" onClick={() => router.push("/onboarding")}>
            Meu perfil
          </button>
          <button type="button" onClick={() => void leave()}>
            Sair
          </button>
        </nav>
      </header>

      {error !== null ? <p role="alert">{error}</p> : null}
      {trips === null && error === null ? <p role="status">Carregando suas viagens…</p> : null}

      {trips !== null && trips.length === 0 ? (
        <p>Você ainda não tem viagem. Comece por uma nova ou deixe o Farol decidir no modo autônomo.</p>
      ) : null}

      {trips !== null && trips.length > 0 ? (
        <ul aria-label="Viagens">
          {trips.map((trip) => (
            <li key={trip.id}>
              <article>
                <h2>{tripCardTitle(trip)}</h2>
                <dl>
                  <dt>Período</dt>
                  <dd>{periodLabel(trip)}</dd>
                  <dt>Viajantes</dt>
                  <dd>{partyLabel(trip.party)}</dd>
                  <dt>Orçamento</dt>
                  <dd>{budgetLabel(trip)}</dd>
                  <dt>Status</dt>
                  <dd>{STATUS_LABEL[trip.status]}</dd>
                </dl>
                <button type="button" onClick={() => router.push(tripResumeRoute(trip))}>
                  Continuar
                </button>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}

export default function TripsHomePage() {
  return <AuthGate>{(token) => <Home token={token} />}</AuthGate>;
}
