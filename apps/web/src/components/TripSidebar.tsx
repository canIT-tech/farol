"use client";

import "./sidebar.css";
import { StepNav, type Step } from "@farol/ui";
import type { TripState } from "@farol/shared";
import { BrandMark } from "./common/BrandHeader";
import { dayPillDate, monthShort } from "../lib/booking-summary";

const UNDEFINED_LABEL = "a definir";

// Etapas como no hi-fi (docs/design/app/*.dc.html): Perfil de gosto → Escolher
// destino → Roteiro → Voo & hotel. Os ids são os segmentos de rota em
// /trips/:id/<id>; "profile" é a exceção e vai para /onboarding (TripShell).
// Quem já tem viagem passou pelo perfil, então ele está sempre concluído.
// Quem chega em qualquer tela do fluxo já passou pelo perfil de gosto — sem
// ele a descoberta nem roda. Viagem ainda não criada (/trips/new) está em
// "Escolher destino", que é exatamente o que a tela faz.
export function tripSteps(trip: TripState | null): Step[] {
  const hasChosen = trip?.chosenDestination != null;

  return [
    { id: "profile", label: "Perfil de gosto", state: "done" },
    { id: "discovery", label: "Escolher destino", state: hasChosen ? "done" : "current" },
    { id: "itinerary", label: "Roteiro", state: hasChosen ? "done" : "todo" },
    { id: "booking", label: "Voo & hotel", state: hasChosen ? "current" : "todo" }
  ] as Step[];
}

export function periodLabel(
  trip: Pick<TripState, "dateStart" | "dateEnd" | "targetMonth" | "durationDays">
): string {
  if (trip.dateStart !== null && trip.dateEnd !== null) {
    // Data crua ("2026-05-10 → 2026-05-17") é ilegível na sidebar estreita.
    return `${dayPillDate(trip.dateStart)} – ${dayPillDate(trip.dateEnd)} ${trip.dateEnd.slice(0, 4)}`;
  }
  if (trip.targetMonth !== null && trip.durationDays !== null) {
    return `${monthShort(trip.targetMonth)} · ${trip.durationDays} dias`;
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

export function destinationLabel(trip: Pick<TripState, "chosenDestination">): string {
  const chosen = trip.chosenDestination;
  return chosen === null ? UNDEFINED_LABEL : `${chosen.city}, ${chosen.country}`;
}

/** Uma linha do cartão da viagem. Campo ainda não decidido fica esmaecido —
 *  o hi-fi distingue o que já está fechado do que falta. */
function Fact({ label, value }: { label: string; value: string }) {
  const pending = value === UNDEFINED_LABEL;
  return (
    <div className={pending ? "side__fact side__fact--pending" : "side__fact"}>
      {label}
      <b>{value}</b>
    </div>
  );
}

// Sidebar do AppShell: marca, cartão da viagem e as etapas — como nas telas 2
// a 5 do hi-fi. Sem lógica de negócio: só formata o que o TripState traz.
export function TripSidebar({
  trip,
  onNavigate
}: {
  trip: TripState | null;
  onNavigate?: (id: string) => void;
}) {
  return (
    <div className="side">
      <BrandMark />

      <div>
        <h2 className="side__heading">Sua viagem</h2>
        <div className="side__card">
          <Fact label="Origem" value={trip === null ? UNDEFINED_LABEL : trip.originIata} />
          <Fact label="Datas" value={trip === null ? UNDEFINED_LABEL : periodLabel(trip)} />
          <Fact label="Viajantes" value={trip === null ? UNDEFINED_LABEL : partyLabel(trip.party)} />
          <Fact label="Orçamento" value={trip === null ? UNDEFINED_LABEL : budgetLabel(trip)} />
          <Fact label="Destino" value={trip === null ? UNDEFINED_LABEL : destinationLabel(trip)} />
        </div>
      </div>

      <div>
        <h2 className="side__heading">Etapas</h2>
        <StepNav steps={tripSteps(trip)} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
