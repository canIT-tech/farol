"use client";

import type { ReactNode } from "react";
import type { TripState } from "@farol/shared";
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

/** Moldura das telas 2 a 5 do hi-fi: sidebar da viagem, miolo e trilho do
 *  assessor. `tripId` nulo é a viagem que ainda não existe (/trips/new): a
 *  sidebar aparece com tudo pendente e o trilho explica que o assessor entra
 *  quando houver viagem — inventar uma conversa ali seria fingir. */
export function ShellFrame({
  tripId,
  trip,
  onNavigate,
  children
}: {
  tripId: string | null;
  trip: TripState | null;
  onNavigate: (step: string) => void;
  children: ReactNode;
}) {
  const router = useRouter();

  async function leave() {
    await signOut();
    router.replace("/");
  }

  return (
    <AppShell
      sidebar={
        <>
          <TripSidebar trip={trip} onNavigate={onNavigate} />
          <nav className="side__account" aria-label="Conta">
            <a href="/trips">Minhas viagens</a>
            <Button type="button" variant="text" size="sm" onClick={() => void leave()}>
              Sair
            </Button>
          </nav>
        </>
      }
      rail={tripId === null ? <RailPlaceholder /> : <Rail tripId={tripId} />}
    >
      {children}
    </AppShell>
  );
}

/** Trilho antes de existir viagem: o assessor diz o que fazer, sem campo — o
 *  chat só existe atrelado a uma viagem. */
function RailPlaceholder() {
  return (
    <div className="rail-intro">
      <p className="rail-intro__title">Assessor</p>
      <p className="rail-intro__bubble">
        Me diz de onde você sai, quando e quanto dá para gastar. Eu cruzo com o seu perfil e
        ranqueio os destinos.
      </p>
      <p className="rail-intro__note">
        A conversa abre assim que a viagem existir — daí dá para pedir ajuste em qualquer parte do
        plano.
      </p>
    </div>
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

  return (
    <ShellFrame
      tripId={tripId}
      trip={trip}
      onNavigate={(step) => router.push(stepRoute(tripId, step))}
    >
      {children}
    </ShellFrame>
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
