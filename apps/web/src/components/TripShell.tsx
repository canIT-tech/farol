"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@farol/ui";
import { AuthGate } from "./AuthGate";
import { TripSidebar } from "./TripSidebar";
import { TripProvider, useTrip } from "../providers/TripProvider";

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

  // O AppShell já monta o <aside aria-label="Assessor"> do trilho; o conteúdo
  // dele entra na Task 6.
  return (
    <AppShell
      sidebar={
        <TripSidebar trip={trip} onNavigate={(step) => router.push(`/trips/${tripId}/${step}`)} />
      }
      rail={null}
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
