"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
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
    return <p role="status">Montando o roteiro…</p>;
  }

  if (error !== null) {
    return (
      <div role="alert">
        <p>Não consegui carregar o roteiro: {error}</p>
        <button type="button" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  if (itinerary === null || itinerary.status === "pending") {
    return <p role="status">Montando o roteiro… isso leva menos de um minuto.</p>;
  }

  if (itinerary.status === "failed") {
    return (
      <div role="alert">
        <p>A geração falhou{itinerary.error !== null ? `: ${itinerary.error}` : "."}</p>
        <button type="button" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
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
    <section>
      <h1>Seu roteiro</h1>
      <DayStrip days={itinerary.days} activeIndex={activeIndex} onSelect={setActiveIndex} />
      {day === undefined ? (
        <p role="status">O roteiro ficou sem dias.</p>
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
      <p>
        <button type="button" onClick={() => router.push(`/trips/${id}/booking`)}>
          Ver voo &amp; hotel
        </button>
      </p>
    </section>
  );
}
