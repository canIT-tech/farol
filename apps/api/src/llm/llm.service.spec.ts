import { describe, it, expect, vi } from "vitest";
import { isDomainError } from "@farol/shared";
import { LlmService, extractJsonArray, type AnthropicLike } from "./llm.service";
import type { RankDestinationsInput } from "./llm.types";

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
  trip: {
    originIata: "GRU",
    party: { adults: 2, children: 0 },
    budgetTotal: 18000,
    currency: "BRL",
    durationDays: 7,
    targetMonth: "2026-09"
  }
};

const R = (rationale = "Justificativa longa o suficiente para o schema.") => rationale;
const VALID_JSON = JSON.stringify([
  { iata: "LIS", score: 0.9, rationale: R() },
  { iata: "OPO", score: 0.8, rationale: R() },
  { iata: "MAD", score: 0.7, rationale: R() }
]);

function fakeClient(texts: string[]) {
  const calls: { model: string; system: string; content: string }[] = [];
  let i = 0;
  const client: AnthropicLike = {
    messages: {
      create: vi.fn(async (args) => {
        calls.push({ model: args.model, system: args.system, content: args.messages[0]!.content });
        const text = texts[Math.min(i, texts.length - 1)]!;
        i += 1;
        return {
          model: "claude-sonnet-5",
          content: [{ type: "text", text }],
          usage: { input_tokens: 1200, output_tokens: 300 }
        };
      })
    }
  };
  return { client, calls };
}

describe("extractJsonArray", () => {
  it("devolve o array quando o texto já é só o array", () => {
    expect(extractJsonArray("[1,2,3]")).toBe("[1,2,3]");
  });

  it("recorta o array de dentro de prosa", () => {
    expect(extractJsonArray('bla bla [{"a":1}] e mais texto')).toBe('[{"a":1}]');
  });

  it("vai do primeiro '[' ao último ']'", () => {
    expect(extractJsonArray("x [a] y [b] z")).toBe("[a] y [b]");
  });

  it("devolve o texto original quando não há '['", () => {
    expect(extractJsonArray("sem colchetes")).toBe("sem colchetes");
  });

  it("devolve o texto original quando só há '[' (sem ']')", () => {
    expect(extractJsonArray("abre [ mas nao fecha")).toBe("abre [ mas nao fecha");
  });

  it("devolve o texto original quando ']' vem antes de '['", () => {
    expect(extractJsonArray("fecha ] antes de abrir [")).toBe("fecha ] antes de abrir [");
  });
});

describe("LlmService.rankDestinations", () => {
  it("resolve com o ranking na primeira tentativa e loga uma métrica", async () => {
    const { client, calls } = fakeClient([VALID_JSON]);
    const logger = { info: vi.fn() };
    const service = new LlmService(client, "claude-sonnet-5", logger);

    const ranking = await service.rankDestinations(input);

    expect(ranking.map((r) => r.iata)).toEqual(["LIS", "OPO", "MAD"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe("claude-sonnet-5");
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info.mock.calls[0]![0]).toMatchObject({
      model: "claude-sonnet-5",
      inputTokens: 1200,
      outputTokens: 300,
      kind: "rank_destinations"
    });
    expect(logger.info.mock.calls[0]![0].estimatedUsd).toBeGreaterThan(0);
    const { latencyMs } = logger.info.mock.calls[0]![0];
    expect(latencyMs).toBeGreaterThanOrEqual(0);
    expect(latencyMs).toBeLessThan(5000);
  });

  it("extrai o JSON mesmo quando vem cercado de prosa", async () => {
    const { client } = fakeClient([`Claro! Aqui:\n${VALID_JSON}\nEspero ter ajudado.`]);
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });
    const ranking = await service.rankDestinations(input);
    expect(ranking).toHaveLength(3);
  });

  it("ignora blocos de conteúdo sem texto ao montar a resposta", async () => {
    const client: AnthropicLike = {
      messages: {
        create: vi.fn(async () => ({
          model: "claude-sonnet-5",
          content: [{ type: "image" }, { type: "text", text: VALID_JSON }],
          usage: { input_tokens: 10, output_tokens: 5 }
        }))
      }
    };
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });
    const ranking = await service.rankDestinations(input);
    expect(ranking).toHaveLength(3);
  });

  it("faz 1 retry quando a 1ª resposta não é JSON e inclui o erro no novo prompt", async () => {
    const { client, calls } = fakeClient(["desculpe, não consigo", VALID_JSON]);
    const logger = { info: vi.fn() };
    const service = new LlmService(client, "claude-sonnet-5", logger);

    const ranking = await service.rankDestinations(input);

    expect(ranking).toHaveLength(3);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.content).toContain("rejeitada: a resposta não era JSON válido");
    expect(logger.info).toHaveBeenCalledTimes(2);
  });

  it("no retry após iata inválido, informa exatamente qual iata saiu da lista", async () => {
    const stray = JSON.stringify([
      { iata: "ZZZ", score: 0.9, rationale: R() },
      { iata: "OPO", score: 0.8, rationale: R() },
      { iata: "MAD", score: 0.7, rationale: R() }
    ]);
    const { client, calls } = fakeClient([stray, VALID_JSON]);
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });
    await service.rankDestinations(input);
    expect(calls[1]!.content).toContain("iata fora da shortlist: ZZZ");
  });

  it("no retry após schema inválido, repassa a mensagem do zod", async () => {
    const badScore = JSON.stringify([
      { iata: "LIS", score: 9, rationale: R() },
      { iata: "OPO", score: 0.8, rationale: R() },
      { iata: "MAD", score: 0.7, rationale: R() }
    ]);
    const { client, calls } = fakeClient([badScore, VALID_JSON]);
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });
    await service.rankDestinations(input);
    expect(calls[1]!.content.toLowerCase()).toContain("rejeitada");
    expect(calls[1]!.content).not.toContain("não era JSON");
  });

  it("rejeita com DomainError llm_invalid_output quando as 2 tentativas falham", async () => {
    const { client, calls } = fakeClient(["nada", "também nada"]);
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });

    await service.rankDestinations(input).then(
      () => expect.unreachable("deveria ter rejeitado"),
      (err: unknown) => {
        expect(isDomainError(err)).toBe(true);
        expect((err as { code: string }).code).toBe("llm_invalid_output");
      }
    );
    expect(calls).toHaveLength(2);
  });

  it("rejeita quando o ranking tem iata fora da shortlist", async () => {
    const stray = JSON.stringify([
      { iata: "XXX", score: 0.9, rationale: R() },
      { iata: "OPO", score: 0.8, rationale: R() },
      { iata: "MAD", score: 0.7, rationale: R() }
    ]);
    const { client } = fakeClient([stray, stray]);
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });
    await expect(service.rankDestinations(input)).rejects.toThrow("ranking válido");
  });

  it("rejeita quando o schema falha (menos de 3 itens)", async () => {
    const short = JSON.stringify([{ iata: "LIS", score: 0.9, rationale: R() }]);
    const { client } = fakeClient([short, short]);
    const service = new LlmService(client, "claude-sonnet-5", { info: vi.fn() });
    await expect(service.rankDestinations(input)).rejects.toThrow();
  });
});
