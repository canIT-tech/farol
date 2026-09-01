import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { MockLanguageModelV4 } from "ai/test";
import { AiSdkLlmProvider } from "./ai-sdk.provider";
import type { LlmCallMetrics, LlmLogger } from "../llm.types";

function loggerSpy(): { logger: LlmLogger; calls: LlmCallMetrics[] } {
  const calls: LlmCallMetrics[] = [];
  return { logger: { info: (m) => calls.push(m) }, calls };
}

// O protocolo v4 usa usage aninhado ({ inputTokens: { total, noCache, ... } });
// o generateText achata isso em { inputTokens, outputTokens } no resultado.
function protocolUsage(input: number | undefined, output: number | undefined) {
  return {
    inputTokens: { total: input, noCache: input, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: output, reasoning: undefined }
  };
}

function modelReturning(
  content: unknown[],
  usage: { inputTokens?: number; outputTokens?: number } = { inputTokens: 10, outputTokens: 5 }
): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    modelId: "modelo-de-teste",
    doGenerate: async () => ({
      content,
      finishReason: "stop",
      usage: protocolUsage(usage.inputTokens, usage.outputTokens),
      warnings: []
    })
  } as never);
}

function providerWith(model: MockLanguageModelV4) {
  const { logger, calls } = loggerSpy();
  const provider = new AiSdkLlmProvider(() => model as never, "groq", logger);
  return { provider, calls };
}

const baseRequest = {
  tier: "capable" as const,
  kind: "chat",
  tripId: "t-1",
  system: "sys",
  messages: [{ role: "user" as const, content: "oi" }]
};

describe("AiSdkLlmProvider.complete", () => {
  it("traduz resposta de texto para LlmCompletion", async () => {
    const { provider } = providerWith(modelReturning([{ type: "text", text: "olá" }]));

    const result = await provider.complete(baseRequest);

    expect(result.text).toBe("olá");
    expect(result.toolCalls).toEqual([]);
    expect(result.model).toBe("modelo-de-teste");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("traduz tool call do SDK para LlmToolCall", async () => {
    const model = modelReturning([
      {
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "set_budget",
        input: JSON.stringify({ total: 5000 })
      }
    ]);
    const { provider } = providerWith(model);

    const result = await provider.complete({
      ...baseRequest,
      tools: [
        {
          name: "set_budget",
          description: "Define o orçamento",
          parameters: z.object({ total: z.number() })
        }
      ]
    });

    expect(result.toolCalls).toEqual([
      { id: "call-1", name: "set_budget", args: { total: 5000 } }
    ]);
  });

  it("usage ausente vira zero em vez de NaN", async () => {
    const { provider, calls } = providerWith(
      modelReturning([{ type: "text", text: "x" }], {
        inputTokens: undefined,
        outputTokens: undefined
      })
    );

    const result = await provider.complete({ ...baseRequest, tripId: null });

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    // O modelo do fake nao esta no MODEL_PRICING, entao o custo e desconhecido.
    expect(calls[0]!.estimatedUsd).toBeNull();
  });

  it("loga métricas com tripId, kind e a chave provider:model", async () => {
    const { provider, calls } = providerWith(
      modelReturning([{ type: "text", text: "ok" }], { inputTokens: 100, outputTokens: 50 })
    );

    await provider.complete({ ...baseRequest, tripId: "trip-42" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.tripId).toBe("trip-42");
    expect(calls[0]!.kind).toBe("chat");
    expect(calls[0]!.inputTokens).toBe(100);
    expect(calls[0]!.outputTokens).toBe(50);
    expect(calls[0]!.model).toBe("modelo-de-teste");
    expect(calls[0]!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("escolhe o modelo pelo tier pedido", async () => {
    const model = modelReturning([{ type: "text", text: "ok" }]);
    const resolve = vi.fn(() => model as never);
    const provider = new AiSdkLlmProvider(resolve, "groq", { info: () => undefined });

    await provider.complete({ ...baseRequest, tier: "cheap" });

    expect(resolve).toHaveBeenCalledWith("cheap");
  });

  it("manda system e a mensagem do usuário para o modelo", async () => {
    const model = modelReturning([{ type: "text", text: "ok" }]);
    const { provider } = providerWith(model);

    await provider.complete(baseRequest);

    const call = model.doGenerateCalls[0]!;
    expect(JSON.stringify(call.prompt)).toContain("oi");
    expect(JSON.stringify(call.prompt)).toContain("sys");
  });

  it("traduz histórico com tool call e resultado de tool", async () => {
    const model = modelReturning([{ type: "text", text: "pronto" }]);
    const { provider } = providerWith(model);

    await provider.complete({
      ...baseRequest,
      messages: [
        { role: "user", content: "muda o orçamento" },
        {
          role: "assistant",
          content: null,
          toolCalls: [{ id: "c-1", name: "set_budget", args: { total: 100 } }]
        },
        {
          role: "tool",
          content: '{"success":true}',
          toolCallId: "c-1",
          name: "set_budget"
        }
      ],
      tools: [
        {
          name: "set_budget",
          description: "Define o orçamento",
          parameters: z.object({ total: z.number() })
        }
      ]
    });

    const sent = JSON.stringify(model.doGenerateCalls[0]!.prompt);
    expect(sent).toContain("set_budget");
    expect(sent).toContain("c-1");
  });

  it("mensagem de assistente sem tool call vai como texto", async () => {
    const model = modelReturning([{ type: "text", text: "ok" }]);
    const { provider } = providerWith(model);

    await provider.complete({
      ...baseRequest,
      messages: [
        { role: "user", content: "oi" },
        { role: "assistant", content: "olá" }
      ]
    });

    expect(JSON.stringify(model.doGenerateCalls[0]!.prompt)).toContain("olá");
  });

  it("conteúdo nulo vira string vazia em vez de quebrar", async () => {
    const model = modelReturning([{ type: "text", text: "ok" }]);
    const { provider } = providerWith(model);

    await expect(
      provider.complete({
        ...baseRequest,
        messages: [{ role: "user", content: null }]
      })
    ).resolves.toBeDefined();
  });

  it("resultado de tool sem toolCallId nem name não quebra a tradução", async () => {
    const model = modelReturning([{ type: "text", text: "ok" }]);
    const { provider } = providerWith(model);

    await expect(
      provider.complete({
        ...baseRequest,
        messages: [{ role: "tool", content: "{}" }]
      })
    ).resolves.toBeDefined();
  });

  it("tool call sem input vira args vazio", async () => {
    const model = modelReturning([
      { type: "tool-call", toolCallId: "c-2", toolName: "search_flights", input: "{}" }
    ]);
    const { provider } = providerWith(model);

    const result = await provider.complete({
      ...baseRequest,
      tools: [
        {
          name: "search_flights",
          description: "Busca voos",
          parameters: z.object({})
        }
      ]
    });

    expect(result.toolCalls).toEqual([{ id: "c-2", name: "search_flights", args: {} }]);
  });

  it("resultado de tool com conteúdo nulo vira string vazia", async () => {
    const model = modelReturning([{ type: "text", text: "ok" }]);
    const { provider } = providerWith(model);

    await expect(
      provider.complete({
        ...baseRequest,
        messages: [{ role: "tool", content: null, toolCallId: "c-9", name: "set_budget" }]
      })
    ).resolves.toBeDefined();
  });
});

describe("AiSdkLlmProvider.completeStructured", () => {
  it("devolve o objeto validado pelo schema e loga", async () => {
    const model = modelReturning([{ type: "text", text: JSON.stringify({ picks: ["LIS"] }) }], {
      inputTokens: 4,
      outputTokens: 2
    });
    const { provider, calls } = providerWith(model);

    const result = await provider.completeStructured({
      tier: "capable",
      kind: "rank_destinations",
      tripId: "t-9",
      system: "s",
      prompt: "p",
      schema: z.object({ picks: z.array(z.string()) })
    });

    expect(result).toEqual({ picks: ["LIS"] });
    expect(calls[0]!.kind).toBe("rank_destinations");
    expect(calls[0]!.tripId).toBe("t-9");
    expect(calls[0]!.inputTokens).toBe(4);
  });
});
