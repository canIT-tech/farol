"use client";

import { StepNav, type Step } from "@farol/ui";
import type { TripState } from "@farol/shared";

const UNDEFINED_LABEL = "a definir";

// Etapas como no hi-fi (docs/design/app/*.dc.html): Perfil de gosto → Escolher
// destino → Roteiro → Voo & hotel. Os ids são os segmentos de rota em
// /trips/:id/<id>; "profile" é a exceção e vai para /onboarding (TripShell).
// Quem já tem viagem passou pelo perfil, então ele está sempre concluído.
export function tripSteps(trip: TripState | null): Step[] {
  const hasChosen = trip?.chosenDestination != null;

  return [
    { id: "profile", label: "Perfil de gosto", state: "done" },
    { id: "discovery", label: "Escolher destino", state: hasChosen ? "done" : "current" },
    { id: "itinerary", label: "Roteiro", state: hasChosen ? "done" : "todo" },
    { id: "booking", label: "Voo & hotel", state: hasChosen ? "current" : "todo" }
  ].map((step) => (trip === null ? { ...step, state: "todo" as const } : step)) as Step[];
}

export function periodLabel(
  trip: Pick<TripState, "dateStart" | "dateEnd" | "targetMonth" | "durationDays">
): string {
  if (trip.dateStart !== null && trip.dateEnd !== null) {
    return `${trip.dateStart} → ${trip.dateEnd}`;
  }
  if (trip.targetMonth !== null && trip.durationDays !== null) {
    return `${trip.targetMonth} · ${trip.durationDays} dias`;
  }
  return UNDEFINED_LABEL;
}

export function partyLabel(party: TripState["party"]): string {
  const adults = `${party.adults} ${party.adults === 1 ? "adulto" : "adultos"}`;
  if (party.children === 0) {
    return adults;
  }
  return `${adults} · ${party.children} ${party.children === 1 ? "criança" : "crianças"}`;
}

export function budgetLabel(trip: Pick<TripState, "budgetTotal" | "currency">): string {
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
