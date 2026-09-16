import { describe, it, expect } from "vitest";
import { ApiError } from "./api-client";
import { creditsRoute, isPaymentRequired } from "./payment-required";

describe("isPaymentRequired", () => {
  it("é verdadeiro só para ApiError 402", () => {
    expect(isPaymentRequired(new ApiError("sem crédito", 402, "/trips/1/destination"))).toBe(true);
    expect(isPaymentRequired(new ApiError("não achei", 404, "/x"))).toBe(false);
    expect(isPaymentRequired(new Error("qualquer"))).toBe(false);
    expect(isPaymentRequired(null)).toBe(false);
  });
});

describe("creditsRoute", () => {
  it("leva para /credits guardando o caminho de volta codificado", () => {
    expect(creditsRoute("/trips/abc/discovery")).toBe("/credits?returnTo=%2Ftrips%2Fabc%2Fdiscovery");
  });
});
