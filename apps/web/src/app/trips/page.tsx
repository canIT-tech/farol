"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tasteProfileSchema, type Trip } from "@farol/shared";
import { Button } from "@farol/ui";
import { AuthGate } from "../../components/AuthGate";
import { BrandHeader } from "../../components/common/BrandHeader";
import { CreditsBadge } from "../../components/common/CreditsBadge";
import "./trips.css";
import { budgetLabel, partyLabel, periodLabel } from "../../components/TripSidebar";
import { ApiError, apiFetch } from "../../lib/api-client";
import { signOut } from "../../lib/session";
import { tripCardTitle, tripResumeRoute } from "../../lib/trip-home";
import { deleteTrip, listTrips } from "../../lib/trip-api";

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
  // Remover é irreversível e leva o roteiro junto: o primeiro clique só arma a
  // confirmação, no próprio cartão. Diálogo nativo bloquearia a página inteira.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(tripId: string) {
    setRemoving(tripId);
    setError(null);
    try {
      await deleteTrip(token, tripId);
      setTrips((current) => (current ?? []).filter((trip) => trip.id !== tripId));
      setConfirming(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui remover a viagem");
    } finally {
      setRemoving(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await apiFetch({ path: "/me/profile", schema: tasteProfileSchema, token });
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 404) {
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
    <main className="screen screen--wide">
      <BrandHeader>
        <nav className="trips__nav" aria-label="Ações">
          <CreditsBadge token={token} />
          <Button type="button" variant="text" onClick={() => router.push("/onboarding")}>
            Meu perfil
          </Button>
          <Button type="button" variant="text" onClick={() => void leave()}>
            Sair
          </Button>
        </nav>
      </BrandHeader>

      <div className="screen__card">
        <h1 className="screen__title">Minhas viagens</h1>
        <p className="screen__sub">
          Retome de onde parou, ou comece uma nova — do jeito que preferir.
        </p>

        <div className="screen__row trips__nav">
          <Button type="button" onClick={() => router.push("/trips/new")}>
            Nova viagem
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/auto")}>
            Modo autônomo
          </Button>
        </div>

        {error !== null ? (
          <p className="screen__error" role="alert">
            {error}
          </p>
        ) : null}
        {trips === null && error === null ? (
          <p className="screen__status" role="status">
            Carregando suas viagens…
          </p>
        ) : null}

        {trips !== null && trips.length === 0 ? (
          <p className="trips__empty">
            Você ainda não tem viagem. Comece por uma nova ou deixe o Farol decidir no modo
            autônomo.
          </p>
        ) : null}

        {trips !== null && trips.length > 0 ? (
          <ul className="trips__list" aria-label="Viagens">
            {trips.map((trip) => (
              <li key={trip.id}>
                <article className="trips__card">
                  <div className="trips__card-head">
                    <h2 className="trips__city">{tripCardTitle(trip)}</h2>
                    <span
                      className={
                        trip.status === "draft"
                          ? "trips__status"
                          : "trips__status trips__status--planned"
                      }
                    >
                      {STATUS_LABEL[trip.status]}
                    </span>
                  </div>
                  <dl className="trips__facts">
                    <dt>Período</dt>
                    <dd>{periodLabel(trip)}</dd>
                    <dt>Viajantes</dt>
                    <dd>{partyLabel(trip.party)}</dd>
                    <dt>Orçamento</dt>
                    <dd>{budgetLabel(trip)}</dd>
                  </dl>
                  <div className="trips__actions">
                    {confirming === trip.id ? (
                      <>
                        <span className="trips__confirm">Remover esta viagem?</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={removing === trip.id}
                          loading={removing === trip.id}
                          onClick={() => void remove(trip.id)}
                        >
                          Sim, remover
                        </Button>
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          onClick={() => setConfirming(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => router.push(tripResumeRoute(trip))}
                        >
                          Continuar
                        </Button>
                        <Button
                          type="button"
                          variant="text"
                          size="sm"
                          className="trips__remove"
                          aria-label={`Remover ${tripCardTitle(trip)}`}
                          onClick={() => setConfirming(trip.id)}
                        >
                          Remover
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}

export default function TripsHomePage() {
  return <AuthGate>{(token) => <Home token={token} />}</AuthGate>;
}
