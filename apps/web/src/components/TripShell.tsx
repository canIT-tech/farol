"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdvisorChat, AppShell, Button } from "@farol/ui";
import { AuthGate } from "./AuthGate";
import { TripSidebar } from "./TripSidebar";
import { TripProvider, useTrip } from "../providers/TripProvider";
import { useChat } from "../hooks/useChat";
import { signOut } from "../lib/session";

// "profile" é a única etapa fora de /trips/:id — mora em /onboarding.
export function stepRoute(tripId: string, step: string): string {
  return step === "profile" ? "/onboarding" : `/trips/${tripId}/${step}`;
}

function Rail({ tripId }: { tripId: string }) {
  const { token, refetch } = useTrip();
  const { messages, pending, error, send } = useChat(token, tripId, refetch);

  return (
    <>
      <AdvisorChat messages={messages} pending={pending} onSend={(text) => void send(text)} />
      {error !== null ? (
        <p className="bk-note" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function TripFrame({ tripId, children }: { tripId: string; children: ReactNode }) {
  const { trip, error, refetch } = useTrip();
  const router = useRouter();

  if (error !== null) {
    return (
      <section className="pane">
        <div className="pane__error" role="alert">
          <span>Não consegui carregar a viagem: {error}</span>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      </section>
    );
  }

  async function leave() {
    await signOut();
    router.replace("/");
  }

  return (
    <AppShell
      sidebar={
        <>
          <TripSidebar trip={trip} onNavigate={(step) => router.push(stepRoute(tripId, step))} />
          <nav className="side__account" aria-label="Conta">
            <a href="/trips">Minhas viagens</a>
            <Button type="button" variant="text" size="sm" onClick={() => void leave()}>
              Sair
            </Button>
          </nav>
        </>
      }
      rail={<Rail tripId={tripId} />}
    >
      {children}
    </AppShell>
  );
}

export function TripShell({ tripId, children }: { tripId: string; children: ReactNode }) {
  return (
    <AuthGate>
      {(token) => (
        <TripProvider tripId={tripId} token={token}>
          <TripFrame tripId={tripId}>{children}</TripFrame>
        </TripProvider>
      )}
    </AuthGate>
  );
}
