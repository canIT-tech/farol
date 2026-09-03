"use client";

import type { ReactNode } from "react";
import { FlightOfferCard, HotelOfferCard } from "@farol/ui";
import type {
  FlightOffer,
  HotelOffer,
  ItineraryItem,
  ProviderSection
} from "@farol/shared";
import { walkingNote } from "../../lib/walking-distance";
import "./booking.css";
import { money } from "../../lib/money";

// Nome do parceiro que recebe o clique. O Travelpayouts leva a busca do
// Aviasales, e o hi-fi exige dizer para onde a pessoa está indo antes do clique.
export const FLIGHT_PARTNER = "Aviasales";

// Voo e hotel vêm de preço agregado do parceiro, não de busca ao vivo: o valor
// final é o do parceiro. Dizer isso é a diferença entre assessor e vitrine.
export const APPROX_PRICE_NOTICE =
  "Preço aproximado, do cache do parceiro. O valor final é confirmado no site do parceiro.";

// "há 8 min" — o hi-fi mostra a idade do preço junto das ofertas.
export function freshnessLabel(fetchedAt: string | null, now: number = Date.now()): string | null {
  if (fetchedAt === null) {
    return null;
  }
  const parsed = Date.parse(fetchedAt);
  if (Number.isNaN(parsed)) {
    return null;
  }
  const minutes = Math.max(0, Math.floor((now - parsed) / 60_000));
  if (minutes < 1) {
    return "Preços consultados agora.";
  }
  if (minutes < 60) {
    return `Preços de ${minutes} min atrás.`;
  }
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "Preços de 1 hora atrás." : `Preços de ${hours} horas atrás.`;
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
    <section className="bk-section" aria-label={title}>
      <h2 className="bk-section__title">{title}</h2>
      {section.error !== null ? (
        <p className="bk-empty" role="status">
          Não consegui consultar agora. Tente de novo em alguns minutos.
        </p>
      ) : section.offers.length === 0 ? (
        <p className="bk-empty" role="status">
          {empty}
        </p>
      ) : (
        <>{children}</>
      )}
    </section>
  );
}

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
  const freshness = freshnessLabel(section.fetchedAt);

  return (
    <Section title={title} section={section} empty={empty}>
      <ul className="bk-list">
        {section.offers.map((offer, index) => (
          <li key={offer.id}>
            <FlightOfferCard
              carrier={offer.carrier}
              carrierName={offer.carrierName}
              departAt={offer.departAt}
              arriveAt={offer.arriveAt}
              originIata={offer.originIata}
              originName={offer.originName}
              destinationIata={offer.destinationIata}
              destinationName={offer.destinationName}
              durationMinutes={offer.durationMinutes}
              stops={offer.stops}
              price={money(offer.price, offer.currency)}
              priceNote={offer.returnAt === null ? "só ida / pessoa" : "ida e volta / pessoa"}
              deepLink={offer.deepLink}
              partnerName={FLIGHT_PARTNER}
              best={index === 0}
              busy={busy}
              onSelect={() => onSelect(offer.id)}
            />
          </li>
        ))}
      </ul>
      <p className="bk-note" role="note">
        {freshness === null ? APPROX_PRICE_NOTICE : `${freshness} ${APPROX_PRICE_NOTICE}`}
      </p>
    </Section>
  );
}

export function HotelSection({
  section,
  onSelect,
  busy = false,
  itineraryItems = [],
  title = "Hospedagem"
}: {
  section: ProviderSection<HotelOffer>;
  onSelect: (offerId: string) => void;
  busy?: boolean;
  /** Paradas do roteiro, para dizer quantas ficam a pé de cada hotel. */
  itineraryItems?: ItineraryItem[];
  title?: string;
}) {
  return (
    <Section
      title={title}
      section={section}
      empty="Nenhuma hospedagem encontrada para estas datas."
    >
      <ul className="bk-hotels">
        {section.offers.map((offer) => (
          <li key={offer.id}>
            <HotelOfferCard
              name={offer.name}
              region={offer.region}
              walkingNote={walkingNote(offer, itineraryItems)}
              photoUrl={offer.photoUrl}
              rating={offer.rating}
              pricePerNight={money(offer.pricePerNight, offer.currency)}
              deepLink={offer.deepLink}
              busy={busy}
              onSelect={() => onSelect(offer.id)}
            />
          </li>
        ))}
      </ul>
      <p className="bk-note" role="note">{APPROX_PRICE_NOTICE}</p>
    </Section>
  );
}
