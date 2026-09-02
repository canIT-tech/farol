import { describe, it, expect } from "vitest";
import { estimateUsd, MODEL_PRICING, consoleLlmLogger } from "./llm.types";

describe("estimateUsd", () => {
  it("usa o preço do modelo quando a chave provider:model existe", () => {
    const p = MODEL_PRICING["anthropic:claude-sonnet-5"]!;
    expect(p).toBeDefined();
    // 1_000_000 in + 1_000_000 out => in + out (por 1M)
    expect(estimateUsd("anthropic:claude-sonnet-5", 1_000_000, 1_000_000)).toBeCloseTo(
      p.inUsdPerMTok + p.outUsdPerMTok
    );
  });

  it("escala linearmente com os tokens", () => {
    expect(estimateUsd("anthropic:claude-sonnet-5", 500_000, 0)).toBeCloseTo(1);
    expect(estimateUsd("anthropic:claude-sonnet-5", 0, 200_000)).toBeCloseTo(2);
  });

  it("devolve null para modelo sem preço conhecido, em vez de inventar", () => {
    expect(estimateUsd("marte:modelo-x", 1_000_000, 0)).toBeNull();
    // llama no Groq nao entra: sem structured output e sem preco publico.
    expect(estimateUsd("groq:llama-3.3-70b-versatile", 1_000_000, 1_000_000)).toBeNull();
  });

  it("precifica os gpt-oss do Groq", () => {
    expect(estimateUsd("groq:openai/gpt-oss-120b", 1_000_000, 1_000_000)).toBeCloseTo(0.75);
    expect(estimateUsd("groq:openai/gpt-oss-20b", 1_000_000, 1_000_000)).toBeCloseTo(0.375);
  });

  it("o mesmo modelo sob outro provider é outra chave", () => {
    // Sem o prefixo do provider não dá para distinguir preço por fornecedor.
    expect(estimateUsd("claude-sonnet-5", 1_000_000, 0)).toBeNull();
  });

  it("é zero quando não há tokens", () => {
    expect(estimateUsd("anthropic:claude-sonnet-5", 0, 0)).toBe(0);
  });
});

describe("consoleLlmLogger", () => {
  it("registra as métricas com tripId", () => {
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
        latencyMs: 12,
        tripId: "trip-1"
      });
    } finally {
      console.info = original;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("llm_call");
    expect(seen[0]).toContain("rank_destinations");
    // Sem tripId não dá para somar custo por roteiro (Q3 da spec).
    expect(seen[0]).toContain("trip-1");
  });

  it("aceita tripId nulo para chamada fora de uma viagem", () => {
    const original = console.info;
    const seen: string[] = [];
    console.info = (msg: string) => seen.push(msg);
    try {
      consoleLlmLogger.info({
        model: "m",
        inputTokens: 1,
        outputTokens: 1,
        estimatedUsd: 0,
        kind: "chat",
        latencyMs: 1,
        tripId: null
      });
    } finally {
      console.info = original;
    }
    expect(seen[0]).toContain('"tripId":null');
  });
});
