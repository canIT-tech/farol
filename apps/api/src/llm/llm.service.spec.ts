import { describe, it, expect, vi } from "vitest";
import { isDomainError } from "@farol/shared";
import { LlmService } from "./llm.service";
import type { BuildItineraryInput, LlmProvider, RankDestinationsInput } from "./llm.types";

const input: RankDestinationsInput = {
  shortlist: [
    { iata: "LIS", city: "Lisboa", country: "Portugal", tags: ["gastronomia"] },
    { iata: "OPO", city: "Porto", country: "Portugal", tags: ["vinhos"] },
    { iata: "MAD", city: "Madri", country: "Espanha", tags: ["cultura"] }
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

const itineraryInput: BuildItineraryInput = {
  destination: { city: "Lisboa", country: "Portugal" },
  nights: 2,
  pace: "moderado",
  interests: ["gastronomia"],
  party: { adults: 2, children: 0 }
};

const RATIONALE = "Justificativa longa o suficiente para o schema aqui.";

function providerReturning(value: unknown) {
  const completeStructured = vi.fn<LlmProvider["completeStructured"]>(
    () => Promise.resolve(value) as never
  );
  const complete = vi.fn<LlmProvider["complete"]>();
  const provider = { complete, completeStructured } as unknown as LlmProvider;
  return { provider, completeStructured, complete };
}

describe("LlmService.rankDestinations", () => {
  it("devolve o ranking que o provider entregou", async () => {
    const ranking = [
      { iata: "LIS", score: 0.9, rationale: RATIONALE },
      { iata: "OPO", score: 0.8, rationale: RATIONALE }
    ];
    const { provider } = providerReturning({ picks: ranking });

    await expect(new LlmService(provider).rankDestinations(input)).resolves.toEqual(ranking);
  });

  it("pede o tier capable, informa o kind e passa o schema", async () => {
    const { provider, completeStructured } = providerReturning({
      picks: [{ iata: "LIS", score: 0.9, rationale: RATIONALE }]
    });

    await new LlmService(provider).rankDestinations(input);

    const request = completeStructured.mock.calls[0]![0];
    expect(request.tier).toBe("capable");
    expect(request.kind).toBe("rank_destinations");
    expect(request.schema).toBeDefined();
    // A shortlist tem de chegar no prompt, senão o modelo inventa destino.
    expect(request.prompt).toContain("LIS");
  });

  it("rejeita iata fora da shortlist com llm_invalid_output", async () => {
    const { provider } = providerReturning({ picks: [{ iata: "GIG", score: 0.9, rationale: RATIONALE }] });

    try {
      await new LlmService(provider).rankDestinations(input);
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("llm_invalid_output");
      expect((err as Error).message).toContain("GIG");
    }
  });

  it("lista todos os iata inválidos na mensagem", async () => {
    const { provider } = providerReturning({
      picks: [
        { iata: "GIG", score: 0.9, rationale: RATIONALE },
        { iata: "LIS", score: 0.8, rationale: RATIONALE },
        { iata: "CDG", score: 0.7, rationale: RATIONALE }
      ]
    });

    await expect(new LlmService(provider).rankDestinations(input)).rejects.toThrow(/GIG, CDG/);
  });
});

describe("LlmService.buildItinerary", () => {
  it("devolve o roteiro que o provider entregou", async () => {
    const output = {
      days: [{ dayIndex: 1, slots: [{ slot: "morning", type: "activity", title: "Museu" }] }]
    };
    const { provider } = providerReturning(output);

    await expect(new LlmService(provider).buildItinerary(itineraryInput)).resolves.toEqual(output);
  });

  it("pede o tier capable e informa o kind", async () => {
    const { provider, completeStructured } = providerReturning({
      days: [{ dayIndex: 1, slots: [] }]
    });

    await new LlmService(provider).buildItinerary(itineraryInput);

    const request = completeStructured.mock.calls[0]![0];
    expect(request.tier).toBe("capable");
    expect(request.kind).toBe("build_itinerary");
  });

  it("passa os itens pinned no prompt", async () => {
    const { provider, completeStructured } = providerReturning({
      days: [{ dayIndex: 1, slots: [] }]
    });

    await new LlmService(provider).buildItinerary({
      ...itineraryInput,
      pinned: [{ dayIndex: 1, slot: "morning", type: "activity", title: "Museu fixado" }]
    });

    const request = completeStructured.mock.calls[0]![0];
    expect(request.prompt).toContain("Museu fixado");
  });
});

describe("LlmService.chat", () => {
  it("repassa system, mensagens, tools e tripId, e devolve a completion", async () => {
    const completion = {
      text: "pronto",
      toolCalls: [],
      model: "m",
      usage: { inputTokens: 1, outputTokens: 1 }
    };
    const complete = vi.fn<LlmProvider["complete"]>(() => Promise.resolve(completion));
    const provider = { complete, completeStructured: vi.fn() } as unknown as LlmProvider;

    const result = await new LlmService(provider).chat({
      system: "sys",
      messages: [{ role: "user", content: "oi" }],
      tools: [],
      tripId: "t-1"
    });

    expect(result).toEqual(completion);
    const request = complete.mock.calls[0]![0];
    expect(request.tier).toBe("cheap");
    expect(request.kind).toBe("chat");
    expect(request.tripId).toBe("t-1");
    expect(request.system).toBe("sys");
  });
});
