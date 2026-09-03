"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Chip } from "@farol/ui";
import type {
  FlightOffer,
  HotelOffer,
  ItineraryItem,
  ProviderSection,
  RouteDeal,
  RoutePriceSample
} from "@farol/shared";
import { FlightSection, HotelSection } from "../../../../components/booking/OfferSections";
import { PriceContext } from "../../../../components/booking/PriceContext";
import { useTrip } from "../../../../providers/TripProvider";
import { bookingSubtitle } from "../../../../lib/booking-summary";
import {
  getFlightCalendar,
  getFlightLatest,
  getFlightMonths,
  getFlightNearby,
  getFlights,
  getHotels,
  getItinerary,
  selectFlight,
  selectHotel
} from "../../../../lib/trip-api";

const OFFLINE = { offers: [], stale: false, fetchedAt: null, error: "unavailable" as const };

type Tab = "flights" | "hotels";

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, trip } = useTrip();
  const [tab, setTab] = useState<Tab>("flights");
  const [flights, setFlights] = useState<ProviderSection<FlightOffer> | null>(null);
  const [hotels, setHotels] = useState<ProviderSection<HotelOffer> | null>(null);
  const [nearby, setNearby] = useState<ProviderSection<FlightOffer>>(OFFLINE);
  const [months, setMonths] = useState<ProviderSection<RouteDeal>>(OFFLINE);
  const [calendar, setCalendar] = useState<ProviderSection<RoutePriceSample>>(OFFLINE);
  const [latest, setLatest] = useState<ProviderSection<RoutePriceSample>>(OFFLINE);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // 7 seções independentes: cada uma já degrada sozinha no catch, então
    // rodam em paralelo em vez de uma esperar a outra terminar.
    const [flightsRes, hotelsRes, nearbyRes, monthsRes, calendarRes, latestRes, itineraryRes] =
      await Promise.all([
        getFlights(token, id).catch(() => OFFLINE),
        getHotels(token, id).catch(() => OFFLINE),
        getFlightNearby(token, id).catch(() => OFFLINE),
        getFlightMonths(token, id).catch(() => OFFLINE),
        getFlightCalendar(token, id).catch(() => OFFLINE),
        getFlightLatest(token, id).catch(() => OFFLINE),
        getItinerary(token, id).catch(() => null)
      ]);
    setFlights(flightsRes);
    setHotels(hotelsRes);
    setNearby(nearbyRes);
    setMonths(monthsRes);
    setCalendar(calendarRes);
    setLatest(latestRes);
    setItems(itineraryRes === null ? [] : itineraryRes.days.flatMap((day) => day.items));
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
    return (
      <section className="pane">
        <p className="pane__status" role="status">
          Consultando voos e hospedagem…
        </p>
      </section>
    );
  }

  return (
    <section className="pane">
      <div className="pane__head">
        <h1 className="pane__title">Voo &amp; hotel</h1>
      </div>
      <p className="pane__sub">{bookingSubtitle(trip)}</p>

      <div className="bk-tabs" role="tablist" aria-label="Voo ou hotel">
        <Chip role="tab" selected={tab === "flights"} onClick={() => setTab("flights")}>
          Voos
        </Chip>
        <Chip role="tab" selected={tab === "hotels"} onClick={() => setTab("hotels")}>
          Hotéis
        </Chip>
      </div>

      {tab === "flights" ? (
        <>
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
        </>
      ) : (
        <HotelSection
          section={hotels}
          busy={busy}
          itineraryItems={items}
          onSelect={(offerId) => void choose(() => selectHotel(token, id, offerId))}
        />
      )}
    </section>
  );
}
