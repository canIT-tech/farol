import type { RouteDeal } from "@farol/shared";
import type { RouteMonthsInput, RouteOffersInput } from "./route-api";

export type TripType = "one-way" | "round-trip";

export interface RouteFormState {
  origin: string;
  destination: string;
  tripType: TripType;
  depart: string;
  return: string;
  adults: number;
  children: number;
}

export function emptyRouteForm(): RouteFormState {
  return {
    origin: "",
    destination: "",
    tripType: "round-trip",
    depart: "",
    return: "",
    adults: 1,
    children: 0
  };
}

const IATA = /^[A-Z]{3}$/;

function route(state: RouteFormState): RouteMonthsInput | null {
  // Quem digita "fln" quer FLN: normalizar aqui evita um 400 da api por caixa.
  const origin = state.origin.trim().toUpperCase();
  const destination = state.destination.trim().toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination)) {
    return null;
  }
  return { origin, destination, adults: state.adults, children: state.children };
}

/** O passo 1 só precisa da rota: "em que mês isso é mais barato". */
export function toMonthsInput(state: RouteFormState): RouteMonthsInput | null {
  return route(state);
}

/** O passo 2 precisa da data. Ida e volta precisa das duas. */
export function toOffersInput(state: RouteFormState): RouteOffersInput | null {
  const base = route(state);
  if (base === null || state.depart === "") {
    return null;
  }
  // O campo de volta continua preenchido quando a pessoa troca para ida só —
  // mandar aquela data assim mesmo buscaria uma passagem que ela não pediu.
  if (state.tripType === "one-way") {
    return { ...base, depart: state.depart };
  }
  if (state.return === "") {
    return null;
  }
  return { ...base, depart: state.depart, return: state.return };
}

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

// A chave do RouteDeal é o mês ("2027-02") no /v1/prices/monthly e o IATA do
// destino no /v1/city-directions. Aqui só o primeiro caso interessa; o outro
// passa cru em vez de virar "mês NaN".
export function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (match === null) {
    return key;
  }
  const month = MONTHS[Number(match[2]) - 1];
  return month === undefined ? key : `${month} de ${match[1]}`;
}

export function cheapestDeal(deals: RouteDeal[]): RouteDeal | null {
  return deals.reduce<RouteDeal | null>(
    (best, deal) => (best === null || deal.price < best.price ? deal : best),
    null
  );
}
