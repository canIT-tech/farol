import type { TripState } from "@farol/shared";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

function day(isoDate: string): number {
  return Number(isoDate.slice(8, 10));
}

function monthName(isoDate: string): string {
  return MONTHS[Number(isoDate.slice(5, 7)) - 1]!;
}

// "10 – 17 de maio" quando é o mesmo mês; "28 de abril – 5 de maio" quando vira.
// Com mês aproximado em vez de datas exatas, cai em "em maio".
export function dateRangeLabel(trip: TripState): string | null {
  if (trip.dateStart !== null && trip.dateEnd !== null) {
    const sameMonth = trip.dateStart.slice(0, 7) === trip.dateEnd.slice(0, 7);
    return sameMonth
      ? `${day(trip.dateStart)} – ${day(trip.dateEnd)} de ${monthName(trip.dateStart)}`
      : `${day(trip.dateStart)} de ${monthName(trip.dateStart)} – ${day(trip.dateEnd)} de ${monthName(trip.dateEnd)}`;
  }
  if (trip.targetMonth !== null) {
    return monthName(`${trip.targetMonth}-01`);
  }
  return null;
}

// Subtítulo da tela de reserva (hi-fi "5 · Voo & hotel"): datas, rota e o aviso
// de que a reserva não acontece aqui. Cada parte só entra se existir de fato.
export function bookingSubtitle(trip: TripState | null): string {
  const closing = "A reserva é concluída no site do parceiro.";
  if (trip === null) {
    return closing;
  }
  const dates = dateRangeLabel(trip);
  const route =
    trip.chosenDestination === null
      ? null
      : `${trip.originIata} → ${trip.chosenDestination.iata}`;
  const parts = [dates, route].filter((part): part is string => part !== null);
  return parts.length === 0 ? closing : `Melhores opções para ${parts.join(", ")}. ${closing}`;
}
