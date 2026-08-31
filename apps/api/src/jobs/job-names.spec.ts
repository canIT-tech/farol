import { describe, it, expect } from "vitest";
import { JOB_NAMES } from "./job-names";

describe("JOB_NAMES", () => {
  it("mapeia os nomes de fila do roteiro", () => {
    expect(JOB_NAMES).toEqual({
      itineraryGenerate: "itinerary.generate",
      itineraryRegenerateDay: "itinerary.regenerate-day",
      placesEnrich: "places.enrich"
    });
  });
});
