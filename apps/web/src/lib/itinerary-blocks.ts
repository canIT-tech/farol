import type { ItineraryDay, ItineraryItem, Slot } from "@farol/shared";

export const SLOT_ORDER: readonly Slot[] = ["morning", "afternoon", "evening"];

export const SLOT_LABEL: Record<Slot, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  evening: "Noite"
};

export interface SlotBlock {
  slot: Slot;
  items: ItineraryItem[];
}

/** O hi-fi mostra o dia em blocos de período. Bloco sem item não aparece —
 *  um título "Noite" vazio só ocuparia espaço. */
export function groupBySlot(day: ItineraryDay): SlotBlock[] {
  return SLOT_ORDER.map((slot) => ({
    slot,
    items: day.items.filter((item) => item.slot === slot)
  })).filter((block) => block.items.length > 0);
}
