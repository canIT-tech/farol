"use client";

import { Button, Chip } from "@farol/ui";
import type { ItineraryDay, ItineraryItem, Slot } from "@farol/shared";

const SLOT_LABEL: Record<Slot, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

export function DayStrip({
  days,
  activeIndex,
  onSelect
}: {
  days: ItineraryDay[];
  activeIndex: number;
  onSelect: (dayIndex: number) => void;
}) {
  return (
    <div role="tablist" aria-label="Dias do roteiro">
      {days.map((day) => (
        <Chip
          key={day.id}
          role="tab"
          selected={day.dayIndex === activeIndex}
          onClick={() => onSelect(day.dayIndex)}
        >
          {`Dia ${day.dayIndex}`}
        </Chip>
      ))}
    </div>
  );
}

export function ItineraryItemCard({
  item,
  onSwapRestaurant
}: {
  item: ItineraryItem;
  onSwapRestaurant?: (itemId: string) => void;
}) {
  return (
    <article aria-label={item.title}>
      <p>{SLOT_LABEL[item.slot]}</p>
      <h3>{item.title}</h3>
      {item.description !== null ? <p>{item.description}</p> : null}
      {item.rating !== null ? <p>{`Nota ${item.rating}`}</p> : null}
      {item.pinned ? <p>Fixado</p> : null}
      {item.needsReview ? (
        <p title="Não achei este lugar no mapa; confira antes de ir.">A conferir</p>
      ) : null}
      {item.type === "meal" && onSwapRestaurant !== undefined ? (
        <Button variant="text" size="sm" onClick={() => onSwapRestaurant(item.id)}>
          Trocar restaurante
        </Button>
      ) : null}
    </article>
  );
}

// Remover e fixar item existem só como tool do chat (remove_item / pin_item),
// não como rota HTTP — essas ações ficam no trilho do assessor.
export function DayTimeline({
  day,
  onRegenerateDay,
  onSwapRestaurant,
  busy = false
}: {
  day: ItineraryDay;
  onRegenerateDay: (dayIndex: number) => void;
  onSwapRestaurant: (itemId: string) => void;
  busy?: boolean;
}) {
  return (
    <section aria-label={`Dia ${day.dayIndex}`}>
      <header>
        <h2>{day.date ?? `Dia ${day.dayIndex}`}</h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => onRegenerateDay(day.dayIndex)}
        >
          Refazer o dia
        </Button>
      </header>
      {day.items.length === 0 ? (
        <p role="status">Este dia está livre.</p>
      ) : (
        <ol>
          {day.items.map((item) => (
            <li key={item.id}>
              <ItineraryItemCard item={item} onSwapRestaurant={onSwapRestaurant} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
