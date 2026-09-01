"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AdvisorChat, AppShell } from "@farol/ui";
import { AuthGate } from "./AuthGate";
import { TripSidebar } from "./TripSidebar";
import { TripProvider, useTrip } from "../providers/TripProvider";
import { useChat } from "../hooks/useChat";

function Rail({ tripId }: { tripId: string }) {
  const { token, refetch } = useTrip();
  const { messages, pending, error, send } = useChat(token, tripId, refetch);

  return (
    <>
      <AdvisorChat messages={messages} pending={pending} onSend={(text) => void send(text)} />
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  );
}

export function TripFrame({ tripId, children }: { tripId: string; children: ReactNode }) {
  const { trip, error, refetch } = useTrip();
  const router = useRouter();

  if (error !== null) {
    return (
      <div role="alert">
        <p>Não consegui carregar a viagem: {error}</p>
        <button type="button" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <AppShell
      sidebar={
        <TripSidebar trip={trip} onNavigate={(step) => router.push(`/trips/${tripId}/${step}`)} />
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
