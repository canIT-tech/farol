import { describe, it, expect } from "vitest";
import { tripCardTitle, tripResumeRoute } from "./trip-home";

describe("tripResumeRoute", () => {
  it("sem destino escolhido volta para a descoberta", () => {
    expect(tripResumeRoute({ id: "t-1", chosenDestinationId: null })).toBe("/trips/t-1/discovery");
  });

  it("com destino escolhido vai para o roteiro", () => {
    expect(tripResumeRoute({ id: "t-1", chosenDestinationId: "d-1" })).toBe("/trips/t-1/itinerary");
  });
});

describe("tripCardTitle", () => {
  it("usa o título quando existe", () => {
    expect(tripCardTitle({ title: "Lua de mel", originIata: "GRU" })).toBe("Lua de mel");
  });

  it("sem título mostra a origem", () => {
    expect(tripCardTitle({ title: null, originIata: "GRU" })).toBe("Saindo de GRU");
  });
});
