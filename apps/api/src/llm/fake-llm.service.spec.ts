import { describe, it, expect } from "vitest";
import { FakeLlmService, fakeSlotTitle } from "./fake-llm.service";
import type { BuildItineraryInput, RankDestinationsInput } from "./llm.types";

const input: RankDestinationsInput = {
  shortlist: [
    { iata: "LIS", city: "Lisboa", country: "Portugal", tags: ["gastronomia"] },
    { iata: "OPO", city: "Porto", country: "Portugal", tags: ["vinhos"] },
    { iata: "MAD", city: "Madri", country: "Espanha", tags: ["cultura"] },
    { iata: "BCN", city: "Barcelona", country: "Espanha", tags: ["praia"] }
  ],
  profile: {
    interests: ["gastronomia", "vinhos", "cultura"],
    pace: "moderado",
    partyType: "casal",
    budgetBand: "medio",
    constraints: {}
  },
  trip: { originIata: "GRU", budgetTotal: 18000, currency: "BRL", party: { adults: 2 } }
};

describe("FakeLlmService", () => {
  it("devolve os 3 primeiros iata da shortlist com score decrescente", async () => {
    const ranking = await new FakeLlmService().rankDestinations(input);
    expect(ranking.map((r) => r.iata)).toEqual(["LIS", "OPO", "MAD"]);
    expect(ranking.map((r) => r.score)).toEqual([0.9, 0.8, 0.7]);
    expect(ranking.every((r) => r.rationale.length >= 10)).toBe(true);
  });

  it("todo iata devolvido está na shortlist", async () => {
    const ranking = await new FakeLlmService().rankDestinations(input);
    const allowed = new Set(input.shortlist.map((s) => s.iata));
    expect(ranking.every((r) => allowed.has(r.iata))).toBe(true);
  });
});

const itineraryInput: BuildItineraryInput = {
  destination: { city: "Lisboa", country: "Portugal" },
  nights: 4,
  pace: "moderado",
  interests: ["gastronomia"],
  party: { adults: 2, children: 1 }
};

describe("fakeSlotTitle", () => {
  it("usa 'Refeição' para meal e 'Atividade' para o resto, com cidade e dia", () => {
    expect(fakeSlotTitle("meal", "Lisboa", 2)).toBe("Refeição de teste — Lisboa dia 2");
    expect(fakeSlotTitle("activity", "Lisboa", 1)).toBe("Atividade de teste — Lisboa dia 1");
    expect(fakeSlotTitle("transfer", "Porto", 3)).toBe("Atividade de teste — Porto dia 3");
  });
});

describe("FakeLlmService.buildItinerary", () => {
  it("gera um dia por noite, com 3 slots e títulos determinísticos", async () => {
    const out = await new FakeLlmService().buildItinerary(itineraryInput);
    expect(out.days.map((d) => d.dayIndex)).toEqual([1, 2, 3, 4]);
    for (const day of out.days) {
      expect(day.slots.map((s) => s.slot)).toEqual(["morning", "afternoon", "evening"]);
      expect(day.slots.map((s) => s.type)).toEqual(["activity", "meal", "activity"]);
      expect(day.slots.map((s) => s.title)).toEqual([
        fakeSlotTitle("activity", "Lisboa", day.dayIndex),
        fakeSlotTitle("meal", "Lisboa", day.dayIndex),
        fakeSlotTitle("activity", "Lisboa", day.dayIndex)
      ]);
    }
  });

  it("recoloca o item pinned no dia e slot certos, sem tocar nos demais slots", async () => {
    const out = await new FakeLlmService().buildItinerary({
      ...itineraryInput,
      pinned: [{ dayIndex: 2, slot: "afternoon", type: "activity", title: "Almoço fixo do usuário" }]
    });
    const day2 = out.days.find((d) => d.dayIndex === 2)!;
    const pinnedSlot = day2.slots.find((s) => s.slot === "afternoon")!;
    expect(pinnedSlot).toEqual({
      slot: "afternoon",
      type: "activity",
      title: "Almoço fixo do usuário",
      description: null,
      durationMin: null,
      estCost: null
    });
    // o slot morning do dia 2 continua o título gerado
    expect(day2.slots.find((s) => s.slot === "morning")!.title).toBe(
      fakeSlotTitle("activity", "Lisboa", 2)
    );
    // o dia 1 não é afetado
    expect(out.days.find((d) => d.dayIndex === 1)!.slots.find((s) => s.slot === "afternoon")!.title).toBe(
      fakeSlotTitle("meal", "Lisboa", 1)
    );
  });

  it("um pinned com slot que não existe naquele dia é ignorado (slot fica gerado)", async () => {
    const out = await new FakeLlmService().buildItinerary({
      ...itineraryInput,
      pinned: [{ dayIndex: 1, slot: "evening", type: "meal", title: "só à noite" }]
    });
    const day1 = out.days.find((d) => d.dayIndex === 1)!;
    expect(day1.slots.find((s) => s.slot === "morning")!.title).toBe(
      fakeSlotTitle("activity", "Lisboa", 1)
    );
    expect(day1.slots.find((s) => s.slot === "evening")!.title).toBe("só à noite");
  });

  it("aceita ausência de pinned", async () => {
    const out = await new FakeLlmService().buildItinerary({ ...itineraryInput, pinned: undefined });
    expect(out.days).toHaveLength(4);
    expect(out.days[0]!.slots[0]!.title).toBe(fakeSlotTitle("activity", "Lisboa", 1));
  });
});

describe("FakeLlmService.chat", () => {
  it("devolve texto determinístico sem tool call por padrão", async () => {
    const result = await new FakeLlmService().chat({
      system: "s",
      messages: [{ role: "user", content: "oi" }],
      tools: [],
      tripId: "t-1"
    });

    expect(result.toolCalls).toEqual([]);
    expect(result.text).toContain("t-1");
    expect(result.model).toBe("fake-model");
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("com nextToolCall a primeira chamada pede a tool e a segunda encerra", async () => {
    const fake = new FakeLlmService({
      nextToolCall: { id: "c-1", name: "set_budget", args: { budgetTotal: 100 } }
    });

    const first = await fake.chat({ system: "s", messages: [], tools: [], tripId: "t-1" });
    expect(first.toolCalls).toEqual([
      { id: "c-1", name: "set_budget", args: { budgetTotal: 100 } }
    ]);
    expect(first.text).toBe("");

    // A segunda encerra o loop; sem isso o ChatService rodaria até MAX_TURNS.
    const second = await fake.chat({ system: "s", messages: [], tools: [], tripId: "t-1" });
    expect(second.toolCalls).toEqual([]);
  });
});
