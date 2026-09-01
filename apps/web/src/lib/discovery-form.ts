import { tripInputSchema, type TripInput } from "@farol/shared";

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
