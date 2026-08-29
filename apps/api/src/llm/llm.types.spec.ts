import { describe, it, expect } from "vitest";
import { estimateUsd, MODEL_PRICING, consoleLlmLogger } from "./llm.types";

describe("estimateUsd", () => {
  it("usa a tabela de preço do modelo", () => {
    const p = MODEL_PRICING["claude-sonnet-5"]!;
    // 1_000_000 in + 1_000_000 out => in + out (por 1M)
    expect(estimateUsd("claude-sonnet-5", 1_000_000, 1_000_000)).toBeCloseTo(
      p.inUsdPerMTok + p.outUsdPerMTok
    );
  });

  it("escala linearmente com os tokens", () => {
    expect(estimateUsd("claude-sonnet-5", 500_000, 0)).toBeCloseTo(1.5);
    expect(estimateUsd("claude-sonnet-5", 0, 200_000)).toBeCloseTo(3);
  });

  it("cai no preço de fallback para modelo desconhecido", () => {
    expect(estimateUsd("modelo-x", 1_000_000, 0)).toBeCloseTo(3);
  });

  it("é zero quando não há tokens", () => {
    expect(estimateUsd("claude-sonnet-5", 0, 0)).toBe(0);
  });
});

describe("consoleLlmLogger", () => {
  it("não lança ao registrar métricas", () => {
    const original = console.info;
    const seen: string[] = [];
    console.info = (msg: string) => seen.push(msg);
    try {
      consoleLlmLogger.info({
        model: "claude-sonnet-5",
        inputTokens: 10,
        outputTokens: 5,
        estimatedUsd: 0.0001,
        kind: "rank_destinations",
        latencyMs: 12
      });
    } finally {
      console.info = original;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("llm_call");
    expect(seen[0]).toContain("rank_destinations");
  });
});
