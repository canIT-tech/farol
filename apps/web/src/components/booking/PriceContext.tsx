"use client";

import type { ProviderSection, RouteDeal, RoutePriceSample } from "@farol/shared";
import { money } from "../../lib/money";

// "2026-11-04" → "4 de nov". Data curta, do jeito que a pessoa lê.
export function shortDate(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC"
  });
}

// "2026-11" → "nov de 2026".
export function monthLabel(key: string): string {
  return new Date(`${key}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function cheapest<T extends { price: number }>(rows: T[]): T | null {
  return rows.reduce<T | null>((best, row) => (best === null || row.price < best.price ? row : best), null);
}

// Faixa observada na rota — é o que sustenta dizer "está barato" sem inventar.
export function priceRangeLabel(samples: RoutePriceSample[]): string | null {
  if (samples.length === 0) {
    return null;
  }
  const prices = samples.map((s) => s.price);
  const currency = samples[0]!.currency;
  return `${money(Math.min(...prices), currency)} a ${money(Math.max(...prices), currency)}`;
}

function Block({
  title,
  section,
  empty,
  render
}: {
  title: string;
  section: ProviderSection<never> | { offers: unknown[]; error: "unavailable" | null };
  empty: string;
  render: () => React.ReactNode;
}): React.ReactElement | null {
  if (section.error !== null) {
    return null;
  }
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      {section.offers.length === 0 ? <p role="status">{empty}</p> : render()}
    </section>
  );
}

// Contexto de preço do Travelpayouts: quando ir, que dia sair, quanto costuma
// custar e se um aeroporto vizinho resolve. É o que o assessor usa para
// explicar a recomendação em vez de só listar ofertas.
export function PriceContext({
  months,
  calendar,
  latest
}: {
  months: ProviderSection<RouteDeal>;
  calendar: ProviderSection<RoutePriceSample>;
  latest: ProviderSection<RoutePriceSample>;
}): React.ReactElement {
  const bestMonth = cheapest(months.offers);
  const bestDay = cheapest(calendar.offers);
  const range = priceRangeLabel(latest.offers);

  return (
    <section aria-label="Contexto de preço">
      <h2>Quando sai mais barato</h2>

      <Block title="Melhor mês" section={months} empty="Sem histórico de preço por mês nesta rota." render={() => (
        <>
          <p>{`${monthLabel(bestMonth!.key)} — ${money(bestMonth!.price, bestMonth!.currency)} com ${bestMonth!.airline}`}</p>
          <ul>
            {months.offers.map((deal) => (
              <li key={deal.key}>{`${monthLabel(deal.key)}: ${money(deal.price, deal.currency)}`}</li>
            ))}
          </ul>
        </>
      )} />

      <Block title="Melhor dia do mês" section={calendar} empty="Sem calendário de preço nesta rota." render={() => (
        <>
          <p>{`${shortDate(bestDay!.departDate)} — ${money(bestDay!.price, bestDay!.currency)}`}</p>
          <ul>
            {calendar.offers.map((day) => (
              <li key={day.departDate}>{`${shortDate(day.departDate)}: ${money(day.price, day.currency)}`}</li>
            ))}
          </ul>
        </>
      )} />

      <Block title="Faixa recente" section={latest} empty="Sem preços recentes nesta rota." render={() => (
        <p>{`Nos últimos meses esta rota saiu entre ${range}.`}</p>
      )} />
    </section>
  );
}
