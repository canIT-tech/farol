"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
import { DayStrip, DayTimeline } from "../../../../components/itinerary/DayTimeline";
import { useItineraryPolling } from "../../../../hooks/useItineraryPolling";
import { useTrip } from "../../../../providers/TripProvider";
import { regenerateDay, swapRestaurant } from "../../../../lib/trip-api";

export default function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { token } = useTrip();
  const { itinerary, loading, error, refetch } = useItineraryPolling(token, id);
  const [activeIndex, setActiveIndex] = useState(1);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <section className="pane">
        <p className="pane__status" role="status">
          Montando o roteiro…
        </p>
      </section>
    );
  }

  if (error !== null) {
    return (
      <section className="pane">
        <div className="pane__error" role="alert">
          <span>Não consegui carregar o roteiro: {error}</span>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      </section>
    );
  }

  if (itinerary === null || itinerary.status === "pending") {
    return (
      <section className="pane">
        <p className="pane__status" role="status">
          Montando o roteiro… isso leva menos de um minuto.
        </p>
      </section>
    );
  }

  if (itinerary.status === "failed") {
    return (
      <section className="pane">
        <div className="pane__error" role="alert">
          <span>A geração falhou{itinerary.error !== null ? `: ${itinerary.error}` : "."}</span>
          <Button type="button" variant="ghost" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      </section>
    );
  }

  const day = itinerary.days.find((d) => d.dayIndex === activeIndex) ?? itinerary.days[0];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pane">
      <div className="pane__head">
        <h1 className="pane__title">Seu roteiro</h1>
      </div>
      <DayStrip days={itinerary.days} activeIndex={activeIndex} onSelect={setActiveIndex} />
      {day === undefined ? (
        <p className="pane__status" role="status">
          O roteiro ficou sem dias.
        </p>
      ) : (
        <DayTimeline
          day={day}
          busy={busy}
          onRegenerateDay={(dayIndex) => void run(() => regenerateDay(token, id, dayIndex))}
          onSwapRestaurant={(itemId) => void run(() => swapRestaurant(token, id, itemId, {}))}
        />
      )}
      {/* Próxima etapa do hi-fi. A sidebar só navega para etapas concluídas, então
          a passagem roteiro → voo & hotel precisa de um botão no miolo. */}
      <div className="it-next">
        <Button
          type="button"
          size="lg"
          onClick={() => router.push(`/trips/${id}/booking`)}
          iconEnd={
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                 strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          }
        >
          Ver voo &amp; hotel
        </Button>
      </div>
    </section>
  );
}
