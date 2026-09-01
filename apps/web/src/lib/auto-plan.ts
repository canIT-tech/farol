import type { DestinationCandidate, TasteProfileInput, TripInput } from "@farol/shared";
import { tasteProfileInputSchema } from "@farol/shared";
import { EMPTY_DISCOVERY_FORM, toTripInput, type DiscoveryFormState } from "./discovery-form";

export const MAX_AUTO_INTERESTS = 3;

export interface AutoFormState {
  originIata: string;
  dateStart: string;
  dateEnd: string;
  budgetTotal: number;
  interests: string[];
}

export const EMPTY_AUTO_FORM: AutoFormState = {
  originIata: "",
  dateStart: "",
  dateEnd: "",
  budgetTotal: EMPTY_DISCOVERY_FORM.budgetTotal,
  interests: []
};

// No modo autônomo a pessoa escolhe até 3 gostos; passar do teto troca o mais
// antigo em vez de bloquear o clique.
export function toggleAutoInterest(selected: string[], interest: string): string[] {
  if (selected.includes(interest)) {
    return selected.filter((item) => item !== interest);
  }
  const next = [...selected, interest];
  return next.length > MAX_AUTO_INTERESTS ? next.slice(next.length - MAX_AUTO_INTERESTS) : next;
}

export function toAutoTripInput(state: AutoFormState): TripInput | null {
  const asDiscovery: DiscoveryFormState = {
    ...EMPTY_DISCOVERY_FORM,
    originIata: state.originIata,
    mode: "exact",
    dateStart: state.dateStart,
    dateEnd: state.dateEnd,
    budgetTotal: state.budgetTotal
  };
  return toTripInput(asDiscovery);
}

// O perfil de gosto é obrigatório para a descoberta rodar. O modo autônomo
// preenche o resto com o meio-termo em vez de perguntar.
export function toAutoTasteProfile(state: AutoFormState): TasteProfileInput | null {
  const parsed = tasteProfileInputSchema.safeParse({
    interests: state.interests,
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio"
  });
  return parsed.success ? parsed.data : null;
}

export function canSubmitAuto(state: AutoFormState): boolean {
  return toAutoTripInput(state) !== null && toAutoTasteProfile(state) !== null;
}

export function bestCandidate(
  candidates: DestinationCandidate[]
): DestinationCandidate | null {
  return candidates.reduce<DestinationCandidate | null>(
    (best, current) => (best === null || current.score > best.score ? current : best),
    null
  );
}
