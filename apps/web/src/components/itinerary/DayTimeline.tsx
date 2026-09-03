"use client";

import { Button, Chip } from "@farol/ui";
import type { ItineraryDay, ItineraryItem } from "@farol/shared";
import { SLOT_LABEL, groupBySlot } from "../../lib/itinerary-blocks";
import "./itinerary.css";

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
    <div className="it-strip" role="tablist" aria-label="Dias do roteiro">
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
  const swappable = item.type === "meal" && onSwapRestaurant !== undefined;
  const hasTags = item.rating !== null || item.pinned || item.needsReview || swappable;

  return (
    <article className="it-card" aria-label={item.title}>
      <div className="it-card__head">
        <h3 className="it-card__title">{item.title}</h3>
      </div>
      {item.description !== null ? <p className="it-card__desc">{item.description}</p> : null}
      {hasTags ? (
        <div className="it-tags">
          {item.rating !== null ? (
            <span className="it-tag it-tag--rating">{`${item.rating} ★`}</span>
          ) : null}
          {item.pinned ? <span className="it-tag">Fixado</span> : null}
          {item.needsReview ? (
            <span className="it-tag it-tag--review" title="Não achei este lugar no mapa; confira antes de ir.">
              A conferir
            </span>
          ) : null}
          {swappable ? (
            <Button variant="text" size="sm" onClick={() => onSwapRestaurant(item.id)}>
              Trocar restaurante
            </Button>
          ) : null}
        </div>
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
  const blocks = groupBySlot(day);

  return (
    <section aria-label={`Dia ${day.dayIndex}`}>
      <header className="it-dayhead">
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
      {blocks.length === 0 ? (
        <p className="pane__status" role="status">
          Este dia está livre.
        </p>
      ) : (
        blocks.map((block) => (
          <div className="it-block" key={block.slot}>
            <p className="it-block__title">{SLOT_LABEL[block.slot]}</p>
            <ol className="it-list">
              {block.items.map((item) => (
                <li key={item.id}>
                  <ItineraryItemCard item={item} onSwapRestaurant={onSwapRestaurant} />
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}
