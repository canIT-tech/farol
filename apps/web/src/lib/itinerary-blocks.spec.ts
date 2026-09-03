import { describe, it, expect } from "vitest";
import type { ItineraryDay, ItineraryItem, Slot } from "@farol/shared";
import { SLOT_LABEL, groupBySlot } from "./itinerary-blocks";

function item(id: string, slot: Slot): ItineraryItem {
  return {
    id,
    slot,
    type: "activity",
    title: id,
    description: null,
    placeId: null,
    lat: null,
    lng: null,
    rating: null,
    pinned: false,
    needsReview: false
  } as ItineraryItem;
}

function day(items: ItineraryItem[]): ItineraryDay {
  return { id: "d1", dayIndex: 1, date: "2026-05-10", items } as ItineraryDay;
}

describe("groupBySlot", () => {
  it("ordena os blocos por período, não pela ordem dos itens", () => {
    const blocks = groupBySlot(day([item("a", "evening"), item("b", "morning")]));
    expect(blocks.map((b) => b.slot)).toEqual(["morning", "evening"]);
  });

  it("descarta bloco sem item", () => {
    const blocks = groupBySlot(day([item("a", "afternoon")]));
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.slot).toBe("afternoon");
  });

  it("mantém a ordem dos itens dentro do bloco", () => {
    const blocks = groupBySlot(day([item("a", "morning"), item("b", "morning")]));
    expect(blocks[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("dia vazio não tem bloco", () => {
    expect(groupBySlot(day([]))).toEqual([]);
  });

  it("rotula os três períodos", () => {
    expect(SLOT_LABEL).toEqual({ morning: "Manhã", afternoon: "Tarde", evening: "Noite" });
  });
});
