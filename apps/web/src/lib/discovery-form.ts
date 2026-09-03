import { tripInputSchema, type TasteProfileInput, type TripInput } from "@farol/shared";

export type DateMode = "exact" | "month";

export interface DiscoveryFormState {
  originIata: string;
  mode: DateMode;
  dateStart: string;
  dateEnd: string;
  targetMonth: string;
  durationDays: number;
  adults: number;
  children: number;
  budgetTotal: number;
}

export const BUDGET_MIN = 1_000;
export const BUDGET_MAX = 60_000;
export const BUDGET_STEP = 500;
export const DURATION_MIN = 2;
export const DURATION_MAX = 30;

export const EMPTY_DISCOVERY_FORM: DiscoveryFormState = {
  originIata: "",
  mode: "month",
  dateStart: "",
  dateEnd: "",
  targetMonth: "",
  durationDays: 7,
  adults: 2,
  children: 0,
  budgetTotal: 12_000
};

// Estado da tela → body de POST /trips. O tripInputSchema exige exatamente um
// entre datas e duração+mês, então o modo decide quais campos vão.
export function toTripInput(state: DiscoveryFormState): TripInput | null {
  const common = {
    originIata: state.originIata.trim().toUpperCase(),
    party: { adults: state.adults, children: state.children },
    budgetTotal: state.budgetTotal,
    currency: "BRL"
  };
  const candidate =
    state.mode === "exact"
      ? { ...common, dateStart: state.dateStart, dateEnd: state.dateEnd }
      : { ...common, targetMonth: state.targetMonth, durationDays: state.durationDays };

  const parsed = tripInputSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function canSubmitDiscovery(state: DiscoveryFormState): boolean {
  return toTripInput(state) !== null;
}

/** O que a sidebar precisa de uma viagem. TripState satisfaz isto, e o
 *  formulário de /trips/new também — assim a sidebar espelha o que a pessoa
 *  está preenchendo, antes de a viagem existir. */
export interface TripSummary {
  originIata: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  targetMonth: string | null;
  durationDays: number | null;
  party: { adults: number; children: number } | null;
  budgetTotal: number | null;
  currency: string;
  chosenDestination: { city: string; country: string } | null;
}

function filled(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

/** Campo em branco vira null para a sidebar mostrar "a definir"; o modo decide
 *  se valem as datas exatas ou o mês aproximado. */
export function draftSummary(state: DiscoveryFormState): TripSummary {
  const exact = state.mode === "exact";
  return {
    originIata: filled(state.originIata.toUpperCase()),
    dateStart: exact ? filled(state.dateStart) : null,
    dateEnd: exact ? filled(state.dateEnd) : null,
    targetMonth: exact ? null : filled(state.targetMonth),
    durationDays: exact ? null : state.durationDays,
    party: { adults: state.adults, children: state.children },
    budgetTotal: state.budgetTotal,
    currency: "BRL",
    chosenDestination: null
  };
}

/** Quantos adultos supor a partir da companhia do perfil de gosto.
 *  Só "sozinho" é dedutível sem chutar: casal, família e amigos variam demais
 *  para adivinhar, e ficam no padrão de 2 — que a pessoa ajusta no stepper. */
export function defaultAdults(partyType: TasteProfileInput["partyType"] | null): number {
  return partyType === "sozinho" ? 1 : EMPTY_DISCOVERY_FORM.adults;
}
