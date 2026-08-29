import { describe, it, expect } from "vitest";
import {
  slotEnum,
  itemTypeEnum,
  itineraryStatusEnum,
  itineraryItemSchema,
  itineraryDaySchema,
  itinerarySchema,
  buildItinerarySlotSchema,
  buildItineraryOutputSchema
} from "./itinerary";

const UUID = "11111111-1111-1111-1111-111111111111";

const item = {
  id: UUID,
  slot: "morning",
  type: "activity",
  title: "Passeio a pé pelo centro histórico",
  description: null,
  placeId: null,
  lat: null,
  lng: null,
  rating: null,
  durationMin: null,
  estCost: null,
  sortOrder: 0,
  pinned: false
};

describe("enums", () => {
  it("slotEnum", () => {
    expect(slotEnum.options).toEqual(["morning", "afternoon", "evening"]);
  });
  it("itemTypeEnum", () => {
    expect(itemTypeEnum.options).toEqual(["activity", "meal", "transfer", "free"]);
  });
  it("itineraryStatusEnum", () => {
    expect(itineraryStatusEnum.options).toEqual(["pending", "ready", "failed"]);
  });
});

describe("itineraryItemSchema", () => {
  it("aceita um item mínimo válido", () => {
    expect(itineraryItemSchema.parse(item)).toEqual(item);
  });

  it("aceita os campos de enrich preenchidos", () => {
    const enriched = {
      ...item,
      description: "Roteiro guiado",
      placeId: "ChIJ123",
      lat: -8.05,
      lng: -34.9,
      rating: 4.6,
      durationMin: 120,
      estCost: 80,
      pinned: true
    };
    expect(itineraryItemSchema.parse(enriched)).toEqual(enriched);
  });

  it("rejeita id que não é uuid", () => {
    expect(() => itineraryItemSchema.parse({ ...item, id: "abc" })).toThrow();
  });

  it("rejeita slot fora do enum", () => {
    expect(() => itineraryItemSchema.parse({ ...item, slot: "night" })).toThrow();
  });

  it("rejeita type fora do enum", () => {
    expect(() => itineraryItemSchema.parse({ ...item, type: "shopping" })).toThrow();
  });

  it("rejeita title vazio", () => {
    expect(() => itineraryItemSchema.parse({ ...item, title: "" })).toThrow();
  });

  it("rejeita durationMin fracionário", () => {
    expect(() => itineraryItemSchema.parse({ ...item, durationMin: 90.5 })).toThrow();
  });

  it("rejeita sortOrder fracionário", () => {
    expect(() => itineraryItemSchema.parse({ ...item, sortOrder: 1.5 })).toThrow();
  });

  it("exige description/placeId/lat/lng/rating/durationMin/estCost presentes (podem ser null)", () => {
    const semNulos = { ...item } as Record<string, unknown>;
    delete semNulos.description;
    expect(() => itineraryItemSchema.parse(semNulos)).toThrow();
  });

  it("rejeita pinned ausente", () => {
    const semPinned = { ...item } as Record<string, unknown>;
    delete semPinned.pinned;
    expect(() => itineraryItemSchema.parse(semPinned)).toThrow();
  });
});

describe("itineraryDaySchema", () => {
  const day = { id: UUID, dayIndex: 1, date: null, notes: null, items: [item] };

  it("aceita um dia válido", () => {
    expect(itineraryDaySchema.parse(day).items).toHaveLength(1);
  });

  it("aceita dia sem itens", () => {
    expect(itineraryDaySchema.parse({ ...day, items: [] }).items).toEqual([]);
  });

  it("rejeita dayIndex < 1", () => {
    expect(() => itineraryDaySchema.parse({ ...day, dayIndex: 0 })).toThrow();
  });

  it("aceita dayIndex = 1 (limite)", () => {
    expect(itineraryDaySchema.parse({ ...day, dayIndex: 1 }).dayIndex).toBe(1);
  });

  it("rejeita dayIndex fracionário", () => {
    expect(() => itineraryDaySchema.parse({ ...day, dayIndex: 1.5 })).toThrow();
  });

  it("aceita date e notes como string", () => {
    const parsed = itineraryDaySchema.parse({ ...day, date: "2026-09-10", notes: "chuva à tarde" });
    expect(parsed.date).toBe("2026-09-10");
    expect(parsed.notes).toBe("chuva à tarde");
  });
});

describe("itinerarySchema", () => {
  const base = {
    id: UUID,
    tripId: UUID,
    version: 1,
    status: "pending",
    error: null,
    generatedAt: null,
    days: []
  };

  it("aceita status pending com days vazio", () => {
    expect(itinerarySchema.parse(base).days).toEqual([]);
  });

  it("aceita status ready com dias e generatedAt", () => {
    const ready = {
      ...base,
      status: "ready",
      generatedAt: "2026-09-01T12:00:00.000Z",
      days: [{ id: UUID, dayIndex: 1, date: null, notes: null, items: [] }]
    };
    expect(itinerarySchema.parse(ready).status).toBe("ready");
  });

  it("rejeita version < 1", () => {
    expect(() => itinerarySchema.parse({ ...base, version: 0 })).toThrow();
  });

  it("rejeita version fracionária", () => {
    expect(() => itinerarySchema.parse({ ...base, version: 1.5 })).toThrow();
  });

  it("rejeita status fora do enum", () => {
    expect(() => itinerarySchema.parse({ ...base, status: "done" })).toThrow();
  });

  it("rejeita tripId que não é uuid", () => {
    expect(() => itinerarySchema.parse({ ...base, tripId: "x" })).toThrow();
  });

  it("aceita error preenchido", () => {
    expect(itinerarySchema.parse({ ...base, status: "failed", error: "modelo falhou" }).error).toBe(
      "modelo falhou"
    );
  });
});

describe("buildItinerarySlotSchema", () => {
  const slot = { slot: "morning", type: "activity", title: "Museu de Arte Moderna" };

  it("aceita um slot mínimo", () => {
    expect(buildItinerarySlotSchema.parse(slot)).toEqual(slot);
  });

  it("aceita os campos opcionais", () => {
    const full = { ...slot, description: "guiado", durationMin: 90, estCost: 40 };
    expect(buildItinerarySlotSchema.parse(full)).toEqual(full);
  });

  it("rejeita title com 1 caractere", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, title: "a" })).toThrow();
  });

  it("aceita title com 2 caracteres (limite inferior)", () => {
    expect(buildItinerarySlotSchema.parse({ ...slot, title: "ab" }).title).toBe("ab");
  });

  it("rejeita title com mais de 120 caracteres", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, title: "x".repeat(121) })).toThrow();
  });

  it("rejeita description com mais de 400 caracteres", () => {
    expect(() =>
      buildItinerarySlotSchema.parse({ ...slot, description: "x".repeat(401) })
    ).toThrow();
  });

  it("rejeita durationMin <= 0", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, durationMin: 0 })).toThrow();
  });

  it("rejeita durationMin fracionário", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, durationMin: 1.5 })).toThrow();
  });

  it("rejeita estCost negativo", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, estCost: -1 })).toThrow();
  });

  it("aceita estCost zero (limite)", () => {
    expect(buildItinerarySlotSchema.parse({ ...slot, estCost: 0 }).estCost).toBe(0);
  });

  it("rejeita slot fora do enum", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, slot: "noite" })).toThrow();
  });

  it("rejeita type fora do enum", () => {
    expect(() => buildItinerarySlotSchema.parse({ ...slot, type: "compras" })).toThrow();
  });
});

describe("buildItineraryOutputSchema", () => {
  const validDay = {
    dayIndex: 1,
    slots: [
      { slot: "morning", type: "activity", title: "Caminhada guiada" },
      { slot: "afternoon", type: "meal", title: "Almoço no mercado" }
    ]
  };

  it("aceita 1 dia com slots válidos", () => {
    expect(buildItineraryOutputSchema.parse({ days: [validDay] }).days).toHaveLength(1);
  });

  it("rejeita days vazio", () => {
    expect(() => buildItineraryOutputSchema.parse({ days: [] })).toThrow();
  });

  it("rejeita slot fora do enum dentro de um dia", () => {
    expect(() =>
      buildItineraryOutputSchema.parse({
        days: [{ dayIndex: 1, slots: [{ slot: "night", type: "activity", title: "Bar" }] }]
      })
    ).toThrow();
  });

  it("rejeita estCost negativo dentro de um slot", () => {
    expect(() =>
      buildItineraryOutputSchema.parse({
        days: [
          { dayIndex: 1, slots: [{ slot: "morning", type: "meal", title: "Café", estCost: -5 }] }
        ]
      })
    ).toThrow();
  });

  it("rejeita dayIndex fracionário", () => {
    expect(() =>
      buildItineraryOutputSchema.parse({ days: [{ ...validDay, dayIndex: 1.5 }] })
    ).toThrow();
  });

  it("aceita um dia com slots vazio (o handler decide o que fazer)", () => {
    expect(
      buildItineraryOutputSchema.parse({ days: [{ dayIndex: 1, slots: [] }] }).days[0]!.slots
    ).toEqual([]);
  });
});
