"use client";

import { StepNav, type Step } from "@farol/ui";
import type { TripState } from "@farol/shared";

const UNDEFINED_LABEL = "a definir";

export function tripSteps(trip: TripState | null): Step[] {
  const hasCandidates = (trip?.destinations.length ?? 0) > 0;
  const hasChosen = trip?.chosenDestination != null;

  return [
    {
      id: "discovery",
      label: "Descoberta",
      state: hasCandidates ? "done" : "current"
    },
    {
      id: "destination",
      label: "Destino",
      state: hasChosen ? "done" : hasCandidates ? "current" : "todo"
    },
    {
      id: "itinerary",
      label: "Roteiro",
      state: hasChosen ? "current" : "todo"
    }
  ].map((step) => (trip === null ? { ...step, state: "todo" as const } : step)) as Step[];
}

function periodLabel(trip: TripState): string {
  if (trip.dateStart !== null && trip.dateEnd !== null) {
    return `${trip.dateStart} → ${trip.dateEnd}`;
  }
  if (trip.targetMonth !== null && trip.durationDays !== null) {
    return `${trip.targetMonth} · ${trip.durationDays} dias`;
  }
  return UNDEFINED_LABEL;
}

function partyLabel(party: TripState["party"]): string {
  const adults = `${party.adults} ${party.adults === 1 ? "adulto" : "adultos"}`;
  if (party.children === 0) {
    return adults;
  }
  return `${adults} · ${party.children} ${party.children === 1 ? "criança" : "crianças"}`;
}

function budgetLabel(trip: TripState): string {
  if (trip.budgetTotal === null) {
    return UNDEFINED_LABEL;
  }
  return trip.budgetTotal.toLocaleString("pt-BR", {
    style: "currency",
    currency: trip.currency,
    maximumFractionDigits: 0
  });
}

// Sidebar do AppShell: resumo da viagem + StepNav. Sem lógica de negócio —
// só formata o que o TripState já traz.
export function TripSidebar({
  trip,
  onNavigate
}: {
  trip: TripState | null;
  onNavigate?: (id: string) => void;
}) {
  if (trip === null) {
    return <p role="status">Carregando a viagem…</p>;
  }

  return (
    <div>
      <dl>
        <dt>Origem</dt>
        <dd>{trip.originIata}</dd>
        <dt>Período</dt>
        <dd>{periodLabel(trip)}</dd>
        <dt>Viajantes</dt>
        <dd>{partyLabel(trip.party)}</dd>
        <dt>Orçamento</dt>
        <dd>{budgetLabel(trip)}</dd>
        {trip.chosenDestination !== null ? (
          <>
            <dt>Destino</dt>
            <dd>
              {trip.chosenDestination.city}, {trip.chosenDestination.country}
            </dd>
          </>
        ) : null}
      </dl>
      <StepNav steps={tripSteps(trip)} onNavigate={onNavigate} />
    </div>
  );
}
