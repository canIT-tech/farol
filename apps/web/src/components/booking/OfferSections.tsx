"use client";

import type { ReactNode } from "react";
import { Button } from "@farol/ui";
import type { FlightOffer, HotelOffer, ProviderSection } from "@farol/shared";

function money(value: number, currency: string): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 });
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export function stopsLabel(stops: number): string {
  if (stops === 0) return "direto";
  return stops === 1 ? "1 parada" : `${stops} paradas`;
}

// Degradação graciosa do design §7.3: provider fora do ar não derruba a tela,
// vira aviso.
function Section<T>({
  title,
  section,
  empty,
  children
}: {
  title: string;
  section: ProviderSection<T>;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {section.error !== null ? (
        <p role="status">Não consegui consultar agora. Tente de novo em alguns minutos.</p>
      ) : section.offers.length === 0 ? (
        <p role="status">{empty}</p>
      ) : (
        <>
          {section.stale ? <p role="status">Preços de alguns minutos atrás.</p> : null}
          {children}
        </>
      )}
    </section>
  );
}

// O Travelpayouts entrega preço cacheado, não busca ao vivo: o valor final é o
// do parceiro. Dizer isso é a diferença entre assessor honesto e vitrine.
export const APPROX_PRICE_NOTICE =
  "Preço aproximado, do cache do parceiro. O valor final é confirmado no site do parceiro.";

export function FlightSection({
  section,
  onSelect,
  busy = false,
  title = "Voos",
  empty = "Nenhum voo encontrado para estas datas."
}: {
  section: ProviderSection<FlightOffer>;
  onSelect: (offerId: string) => void;
  busy?: boolean;
  title?: string;
  empty?: string;
}) {
  return (
    <Section title={title} section={section} empty={empty}>
      <p role="note">{APPROX_PRICE_NOTICE}</p>
      <ul>
        {section.offers.map((offer) => (
          <li key={offer.id}>
            <article aria-label={`${offer.carrier} por ${money(offer.price, offer.currency)}`}>
              <h3>{offer.carrier}</h3>
              <p>{money(offer.price, offer.currency)}</p>
              <p>{`${durationLabel(offer.durationMinutes)} · ${stopsLabel(offer.stops)}`}</p>
              <a href={offer.deepLink} target="_blank" rel="noreferrer">
                Ver no site
              </a>
              <Button size="sm" disabled={busy} onClick={() => onSelect(offer.id)}>
                Escolher
              </Button>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HotelSection({
  section,
  onSelect,
  busy = false
}: {
  section: ProviderSection<HotelOffer>;
  onSelect: (offerId: string) => void;
  busy?: boolean;
}) {
  return (
    <Section title="Hospedagem" section={section} empty="Nenhuma hospedagem encontrada.">
      <ul>
        {section.offers.map((offer) => (
          <li key={offer.id}>
            <article aria-label={offer.name}>
              <h3>{offer.name}</h3>
              {offer.region !== null ? <p>{offer.region}</p> : null}
              <p>{`${money(offer.pricePerNight, offer.currency)} por noite`}</p>
              <p>{`${money(offer.priceTotal, offer.currency)} no total`}</p>
              {offer.rating !== null ? <p>{`Nota ${offer.rating}`}</p> : null}
              <a href={offer.deepLink} target="_blank" rel="noreferrer">
                Ver no site
              </a>
              <Button size="sm" disabled={busy} onClick={() => onSelect(offer.id)}>
                Escolher
              </Button>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
