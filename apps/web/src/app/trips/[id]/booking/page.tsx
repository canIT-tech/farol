"use client";

import { use, useCallback, useEffect, useState } from "react";
import type {
  FlightOffer,
  HotelOffer,
  ProviderSection,
  RouteDeal,
  RoutePriceSample
} from "@farol/shared";
import { FlightSection, HotelSection } from "../../../../components/booking/OfferSections";
import { PriceContext } from "../../../../components/booking/PriceContext";
import { useTrip } from "../../../../providers/TripProvider";
import {
  getFlightCalendar,
  getFlightLatest,
  getFlightMonths,
  getFlightNearby,
  getFlights,
  getHotels,
  selectFlight,
  selectHotel
} from "../../../../lib/trip-api";

const OFFLINE = { offers: [], stale: false, error: "unavailable" as const };

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useTrip();
  const [flights, setFlights] = useState<ProviderSection<FlightOffer> | null>(null);
  const [hotels, setHotels] = useState<ProviderSection<HotelOffer> | null>(null);
  const [nearby, setNearby] = useState<ProviderSection<FlightOffer>>(OFFLINE);
  const [months, setMonths] = useState<ProviderSection<RouteDeal>>(OFFLINE);
  const [calendar, setCalendar] = useState<ProviderSection<RoutePriceSample>>(OFFLINE);
  const [latest, setLatest] = useState<ProviderSection<RoutePriceSample>>(OFFLINE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Provider fora do ar é seção degradada, não tela de erro (design §7.3).
    setFlights(await getFlights(token, id).catch(() => OFFLINE));
    setHotels(await getHotels(token, id).catch(() => OFFLINE));
    // Contexto de preço: cada recorte carrega sozinho e some se falhar.
    setNearby(await getFlightNearby(token, id).catch(() => OFFLINE));
    setMonths(await getFlightMonths(token, id).catch(() => OFFLINE));
    setCalendar(await getFlightCalendar(token, id).catch(() => OFFLINE));
    setLatest(await getFlightLatest(token, id).catch(() => OFFLINE));
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function choose(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (flights === null || hotels === null) {
    return <p role="status">Consultando voos e hospedagem…</p>;
  }

  return (
    <section>
      <h1>Como chegar e onde ficar</h1>
      <FlightSection
        section={flights}
        busy={busy}
        onSelect={(offerId) => void choose(() => selectFlight(token, id, offerId))}
      />
      <FlightSection
        section={nearby}
        busy={busy}
        title="Aeroportos vizinhos"
        empty="Nenhuma alternativa de aeroporto vizinho para estas datas."
        onSelect={(offerId) => void choose(() => selectFlight(token, id, offerId))}
      />
      <PriceContext months={months} calendar={calendar} latest={latest} />
      <HotelSection
        section={hotels}
        busy={busy}
        onSelect={(offerId) => void choose(() => selectHotel(token, id, offerId))}
      />
    </section>
  );
}
