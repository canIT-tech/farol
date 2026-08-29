import { describe, it, expect } from "vitest";
import { BUILD_ITINERARY_SYSTEM, buildItineraryUserPrompt } from "./build-itinerary";
import type { BuildItineraryInput } from "../llm.types";

const input: BuildItineraryInput = {
  destination: { city: "Lisboa", country: "Portugal" },
  nights: 3,
  pace: "moderado",
  interests: ["gastronomia", "história"],
  party: { adults: 2, children: 1 }
};

describe("BUILD_ITINERARY_SYSTEM", () => {
  it("pede JSON e descreve o formato days/slots", () => {
    expect(BUILD_ITINERARY_SYSTEM).toMatch(/JSON/);
    expect(BUILD_ITINERARY_SYSTEM).toContain("dayIndex");
    expect(BUILD_ITINERARY_SYSTEM).toContain("morning|afternoon|evening");
  });
});

describe("buildItineraryUserPrompt", () => {
  it("inclui destino, duração, ritmo, viajantes e interesses", () => {
    const prompt = buildItineraryUserPrompt(input);
    expect(prompt).toContain("Destino: Lisboa, Portugal.");
    expect(prompt).toContain("Duração: 3 dias. Ritmo: moderado.");
    expect(prompt).toContain("2 adulto(s), 1 criança(s)");
    expect(prompt).toContain("Interesses: gastronomia, história.");
  });

  it("não lista itens fixados quando pinned está vazio ou ausente", () => {
    expect(buildItineraryUserPrompt(input)).not.toContain("já fixados");
    expect(buildItineraryUserPrompt({ ...input, pinned: [] })).not.toContain("já fixados");
  });

  it("lista cada item pinned com dia, slot, tipo e título", () => {
    const prompt = buildItineraryUserPrompt({
      ...input,
      pinned: [
        { dayIndex: 1, slot: "evening", type: "meal", title: "Jantar no Chiado" },
        { dayIndex: 2, slot: "morning", type: "activity", title: "Mosteiro dos Jerónimos" }
      ]
    });
    expect(prompt).toContain("já fixados");
    expect(prompt).toContain("- dia 1, evening, meal: Jantar no Chiado");
    expect(prompt).toContain("- dia 2, morning, activity: Mosteiro dos Jerónimos");
  });

  it("acrescenta o erro anterior quando informado", () => {
    expect(buildItineraryUserPrompt(input, "faltou o dia 3")).toContain(
      "rejeitada: faltou o dia 3"
    );
  });
});
