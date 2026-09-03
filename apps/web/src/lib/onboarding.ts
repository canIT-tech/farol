import {
  tasteProfileInputSchema,
  type TasteProfile,
  type TasteProfileInput
} from "@farol/shared";

// Catálogo de interesses do onboarding (rótulo = valor gravado no perfil).
export const INTEREST_OPTIONS = [
  "praia",
  "montanha",
  "gastronomia",
  "vida noturna",
  "cultura e museus",
  "natureza",
  "compras",
  "história",
  "aventura",
  "relaxar",
  "arquitetura",
  "vinhos"
] as const;

export const MIN_INTERESTS = 3;

export function toggleInterest(selected: string[], interest: string): string[] {
  return selected.includes(interest)
    ? selected.filter((item) => item !== interest)
    : [...selected, interest];
}

export interface OnboardingState {
  interests: string[];
  pace: TasteProfileInput["pace"] | null;
  partyType: TasteProfileInput["partyType"] | null;
  budgetBand: TasteProfileInput["budgetBand"] | null;
}

export const EMPTY_ONBOARDING: OnboardingState = {
  interests: [],
  pace: null,
  partyType: null,
  budgetBand: null
};

export function canSubmit(state: OnboardingState): boolean {
  return (
    state.interests.length >= MIN_INTERESTS &&
    state.pace !== null &&
    state.partyType !== null &&
    state.budgetBand !== null
  );
}

export function toTasteProfileInput(state: OnboardingState): TasteProfileInput {
  return tasteProfileInputSchema.parse({
    interests: state.interests,
    pace: state.pace,
    partyType: state.partyType,
    budgetBand: state.budgetBand,
    constraints: {}
  });
}

/** Perfil salvo → estado da tela, para "Meu perfil" abrir com o que já foi
 *  escolhido em vez de um formulário em branco. */
export function fromTasteProfile(profile: TasteProfile): OnboardingState {
  return {
    interests: [...profile.interests],
    pace: profile.pace,
    partyType: profile.partyType,
    budgetBand: profile.budgetBand
  };
}
