"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
import { partyLabel } from "../../../../components/TripSidebar";
import { itinerarySubtitle, itineraryTitle } from "../../../../lib/booking-summary";
import { DayStrip, DayTimeline } from "../../../../components/itinerary/DayTimeline";
import { useItineraryPolling } from "../../../../hooks/useItineraryPolling";
import { useTrip } from "../../../../providers/TripProvider";
import { regenerateDay, swapRestaurant } from "../../../../lib/trip-api";

export default function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { token, trip } = useTrip();
  const { itinerary, loading, error, stalled, refetch } = useItineraryPolling(token, id);
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

  // Pendente demais quase sempre quer dizer que ninguém consumiu o job. Não dá
  // para saber daqui se o worker caiu ou se a fila travou, então a mensagem diz
  // o que é verdade — está demorando — em vez de repetir a promessa de um
  // minuto que já não se cumpriu.
  if (stalled) {
    return (
      <section className="pane">
        <div className="pane__error" role="alert">
          <span>
            O roteiro está demorando mais que o esperado. A geração roda em segundo plano; se
            acabou de sair, tentar de novo já mostra.
          </span>
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
  const subtitle = itinerarySubtitle(trip, trip === null ? null : partyLabel(trip.party));

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
        <div>
          <h1 className="pane__title">{itineraryTitle(trip, itinerary.days.length)}</h1>
          {subtitle !== null ? <p className="pane__sub pane__sub--tight">{subtitle}</p> : null}
        </div>
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
