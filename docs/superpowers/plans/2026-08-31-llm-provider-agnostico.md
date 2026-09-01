# Camada de LLM agnóstica de provider — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar de provider de LLM (Anthropic / Groq / OpenAI) e de modelo dentro do mesmo provider por configuração, sem tocar em nenhum consumidor.

**Architecture:** Porta neutra (`LlmProvider`) com vocabulário próprio — nem do fornecedor, nem da biblioteca. Um único adaptador (`AiSdkLlmProvider`) usa o Vercel AI SDK e é o único arquivo do repo que importa `ai`. Consumidores pedem modelo por **tier de custo** (`cheap` / `capable`); a config resolve tier para provider + id de modelo.

**Tech Stack:** TypeScript, NestJS 10, `ai@7`, `@ai-sdk/anthropic`, `@ai-sdk/groq`, `@ai-sdk/openai`, zod, Vitest, StrykerJS.

**Spec:** `docs/superpowers/specs/2026-08-31-llm-provider-agnostico-design.md`

## Global Constraints

- Trabalhar no worktree `.worktrees/llm-provider-agnostico`, branch `rafaignaulin/llm-provider-agnostico`. Nunca commitar na `main`.
- pnpm. Node 22+ (`.nvmrc` = `22`).
- **Cobertura 100%** de statements/branches/functions/lines em cada pacote. Gate por pacote, não média.
- **Mutação ≥ 90%** por pacote (`break` do Stryker).
- **TDD:** `.spec.ts` primeiro, sempre. Escrever o teste, vê-lo falhar, implementar, vê-lo passar.
- Identificadores em inglês; comentários e docs em PT-BR.
- Commits pequenos, um por task, fechando com as linhas `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01TKNYBm7tzzfNedgGceBHSD`.
- **Nenhuma chamada de rede em teste.** O adaptador é testado contra `MockLanguageModelV4` de `ai/test`.
- **Sem `dotenv` no projeto:** `apps/api` e `apps/worker` leem `process.env` direto. Env local vem de `source .env`.
- Versões exatas verificadas em 2026-08-31: `ai@7.0.87`, `@ai-sdk/anthropic@4.0.46`, `@ai-sdk/groq@4.0.35`, `@ai-sdk/openai@4.0.53`. Peer de todos: `zod ^3.25.76 || ^4.1.8`.
- **Rodar o comando de teste de banco antes de começar** (Task 0), porque a suíte de integração do Passo 7 nunca rodou fora do CI e um vermelho pré-existente não pode ser confundido com regressão deste refactor.

---

### Task 0: Linha de base verde

Não altera código. Existe para separar bug pré-existente de regressão.

**Files:** nenhum.

**Interfaces:**
- Produces: a certeza de que a suíte estava verde antes do refactor.

- [ ] **Step 1: Subir o Postgres e migrar**

```bash
cd .worktrees/llm-provider-agnostico
docker compose up -d db
source .env
pnpm install
pnpm --filter @farol/db run db:migrate
pnpm --filter @farol/db run db:seed
```

- [ ] **Step 2: Rodar a suíte inteira**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Esperado: tudo verde.

- [ ] **Step 3: Se algo falhar, PARAR**

Anotar o que falhou e reportar antes de seguir. Um vermelho aqui é anterior ao refactor e precisa de decisão do parceiro humano — não é para consertar dentro deste plano.

---

### Task 1: Dependências e faixa do zod

**Files:**
- Modify: `apps/api/package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/groq`, `@ai-sdk/openai` instalados em `apps/api`; faixa de zod `^3.25.76` nos três pacotes.

**Contexto:** o `pnpm-lock.yaml` já resolve `zod@3.25.76`, que satisfaz o peer do `ai@7`. Só a faixa **declarada** sobe. Nenhuma dependência muda de versão instalada — por isso o risco é baixo, mas o gate de suíte verde continua valendo.

- [ ] **Step 1: Subir a faixa do zod nos três `package.json`**

Em `apps/api/package.json`, `packages/shared/package.json` e `apps/web/package.json`, trocar:

```json
"zod": "^3.23.0"
```

por:

```json
"zod": "^3.25.76"
```

- [ ] **Step 2: Instalar o AI SDK em `apps/api`**

```bash
cd .worktrees/llm-provider-agnostico
pnpm --filter @farol/api add ai@7.0.87 @ai-sdk/anthropic@4.0.46 @ai-sdk/groq@4.0.35 @ai-sdk/openai@4.0.53
```

Versões exatas, sem `^`: o SDK tem histórico de breaking change entre majors, e a porta só protege se a subida for deliberada.

- [ ] **Step 3: Verificar que nada quebrou**

```bash
pnpm install
pnpm typecheck && pnpm test
```

Esperado: verde. Se o zod quebrar algo, PARAR e reportar — vira decisão à parte, como diz a spec §7.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json packages/shared/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore(deps): AI SDK v7 e faixa de zod ^3.25.76"
```

---

### Task 2: Porta neutra, tiers e métricas

Reescreve `llm.types.ts`. Ninguém consome ainda — o arquivo passa a ter os tipos novos **e** os antigos, para não quebrar os consumidores existentes nesta task.

**Files:**
- Modify: `apps/api/src/llm/llm.types.ts`
- Test: `apps/api/src/llm/llm.types.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type LlmTier = "cheap" | "capable"`
  - `interface LlmToolCall { id: string; name: string; args: Record<string, unknown> }`
  - `interface LlmMessage { role: "user" | "assistant" | "tool"; content: string | null; toolCalls?: LlmToolCall[]; toolCallId?: string }`
  - `interface LlmToolSpec { name: string; description: string; parameters: z.ZodType<Record<string, unknown>> }`
  - `interface LlmCompletion { text: string; toolCalls: LlmToolCall[]; model: string; usage: { inputTokens: number; outputTokens: number } }`
  - `interface LlmCompletionRequest { tier: LlmTier; kind: string; tripId: string | null; system: string; messages: LlmMessage[]; tools?: LlmToolSpec[] }`
  - `interface LlmStructuredRequest<T> { tier: LlmTier; kind: string; tripId: string | null; system: string; prompt: string; schema: z.ZodType<T> }`
  - `interface LlmProvider { complete(r: LlmCompletionRequest): Promise<LlmCompletion>; completeStructured<T>(r: LlmStructuredRequest<T>): Promise<T> }`
  - `estimateUsd(providerModelKey: string, inputTokens: number, outputTokens: number): number` — assinatura mantida, chave passa a ser `"<provider>:<model>"`
  - `LlmCallMetrics` ganha `tripId: string | null`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar em `apps/api/src/llm/llm.types.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { estimateUsd, MODEL_PRICING } from "./llm.types";

describe("estimateUsd com chave provider:model", () => {
  it("usa o preço do modelo quando a chave existe", () => {
    const price = MODEL_PRICING["anthropic:claude-sonnet-5"]!;
    expect(price).toBeDefined();
    const usd = estimateUsd("anthropic:claude-sonnet-5", 1_000_000, 1_000_000);
    expect(usd).toBeCloseTo(price.inUsdPerMTok + price.outUsdPerMTok);
  });

  it("modelo gratuito do Groq custa zero", () => {
    expect(estimateUsd("groq:llama-3.3-70b-versatile", 1_000_000, 1_000_000)).toBe(0);
  });

  it("chave desconhecida cai no fallback em vez de quebrar", () => {
    expect(estimateUsd("marte:modelo-x", 1_000_000, 0)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd .worktrees/llm-provider-agnostico/apps/api
../../node_modules/.bin/vitest run src/llm/llm.types.spec.ts --coverage.enabled=false --pool=threads
```

Esperado: FAIL — a chave `"anthropic:claude-sonnet-5"` não existe em `MODEL_PRICING`.

- [ ] **Step 3: Implementar**

Em `apps/api/src/llm/llm.types.ts`, acrescentar no topo:

```ts
import type { z } from "zod";
```

Acrescentar os tipos da porta (manter tudo que já existe no arquivo):

```ts
// Tier de custo. O call site pede tier; a config resolve para provider + modelo.
export type LlmTier = "cheap" | "capable";

// Chamada de tool pedida pelo modelo. Mesma forma que ChatMessageDto já persiste
// em chat_messages — de propósito, para não haver tradução na borda do banco.
export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
}

// parameters é zod, não JSON Schema: a mesma definição descreve a tool para o
// modelo e valida o args que volta. O adaptador traduz para o formato do SDK.
export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: z.ZodType<Record<string, unknown>>;
}

export interface LlmCompletion {
  text: string;
  toolCalls: LlmToolCall[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmCompletionRequest {
  tier: LlmTier;
  kind: string;
  tripId: string | null;
  system: string;
  messages: LlmMessage[];
  tools?: LlmToolSpec[];
}

export interface LlmStructuredRequest<T> {
  tier: LlmTier;
  kind: string;
  tripId: string | null;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}

// Porta. Único contrato que o app conhece; nenhum nome de fornecedor aqui.
export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
  completeStructured<T>(request: LlmStructuredRequest<T>): Promise<T>;
}
```

Substituir o bloco de preços existente por um chaveado por `provider:model`:

```ts
// Preços aproximados em USD por 1M de tokens, por "<provider>:<model>" — revisar
// periodicamente. Modelo gratuito entra explicitamente como 0 para não cair no
// fallback e logar custo fictício.
export const MODEL_PRICING: Record<string, { inUsdPerMTok: number; outUsdPerMTok: number }> = {
  "anthropic:claude-sonnet-5": { inUsdPerMTok: 3, outUsdPerMTok: 15 },
  "anthropic:claude-haiku-4-5-20251001": { inUsdPerMTok: 0.8, outUsdPerMTok: 4 },
  "groq:llama-3.3-70b-versatile": { inUsdPerMTok: 0, outUsdPerMTok: 0 }
};
```

Acrescentar `tripId` às métricas:

```ts
export interface LlmCallMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  kind: string;
  latencyMs: number;
  // Sem isto não dá para somar custo por roteiro (Q3 da spec original).
  tripId: string | null;
}
```

`estimateUsd` e `consoleLlmLogger` ficam como estão — a assinatura não muda, só o formato da chave.

- [ ] **Step 4: Rodar e ver passar**

```bash
../../node_modules/.bin/vitest run src/llm/llm.types.spec.ts --coverage.enabled=false --pool=threads
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/llm/llm.types.ts apps/api/src/llm/llm.types.spec.ts
git commit -m "feat(llm): porta neutra, tiers e preço por provider:model"
```

---

### Task 3: `AiSdkLlmProvider`

Único arquivo do repo que importa `ai`.

**Files:**
- Create: `apps/api/src/llm/providers/ai-sdk.provider.ts`
- Test: `apps/api/src/llm/providers/ai-sdk.provider.spec.ts`

**Interfaces:**
- Consumes: `LlmProvider`, `LlmCompletionRequest`, `LlmStructuredRequest`, `LlmCompletion`, `LlmToolSpec`, `LlmMessage`, `LlmTier`, `LlmLogger`, `estimateUsd` (Task 2).
- Produces:
  - `type ModelResolver = (tier: LlmTier) => LanguageModel`
  - `class AiSdkLlmProvider implements LlmProvider` — construtor `(resolveModel: ModelResolver, providerName: string, logger: LlmLogger)`

**Notas de tradução verificadas nos tipos do `ai@7.0.87`:**
- `generateText` devolve `{ text, toolCalls, usage }`; cada item de `toolCalls` é `{ toolCallId, toolName, input }`.
- `usage` é `{ inputTokens: number | undefined; outputTokens: number | undefined }` — **pode vir `undefined`**, precisa de fallback para `0`.
- `tool()` usa o campo **`inputSchema`**, não `parameters`. A tradução do nosso `parameters` acontece aqui.
- `generateObject({ model, system, prompt, schema })` devolve `{ object, usage }`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/api/src/llm/providers/ai-sdk.provider.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { MockLanguageModelV4 } from "ai/test";
import { AiSdkLlmProvider } from "./ai-sdk.provider";
import type { LlmLogger, LlmCallMetrics } from "../llm.types";

function loggerSpy(): { logger: LlmLogger; calls: LlmCallMetrics[] } {
  const calls: LlmCallMetrics[] = [];
  return { logger: { info: (m) => calls.push(m) }, calls };
}

function providerWith(model: MockLanguageModelV4) {
  const { logger, calls } = loggerSpy();
  const provider = new AiSdkLlmProvider(() => model, "groq", logger);
  return { provider, calls };
}

describe("AiSdkLlmProvider.complete", () => {
  it("traduz resposta de texto para LlmCompletion", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "olá" }],
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5 },
        warnings: []
      })
    });
    const { provider } = providerWith(model);

    const result = await provider.complete({
      tier: "capable",
      kind: "chat",
      tripId: "t-1",
      system: "sys",
      messages: [{ role: "user", content: "oi" }]
    });

    expect(result.text).toBe("olá");
    expect(result.toolCalls).toEqual([]);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("traduz tool call do SDK para LlmToolCall", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "set_budget",
            input: JSON.stringify({ total: 5000 })
          }
        ],
        finishReason: "tool-calls",
        usage: { inputTokens: 8, outputTokens: 3 },
        warnings: []
      })
    });
    const { provider } = providerWith(model);

    const result = await provider.complete({
      tier: "capable",
      kind: "chat",
      tripId: "t-1",
      system: "sys",
      messages: [{ role: "user", content: "orçamento 5000" }],
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
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "x" }],
        finishReason: "stop",
        usage: { inputTokens: undefined, outputTokens: undefined },
        warnings: []
      })
    });
    const { provider } = providerWith(model);

    const result = await provider.complete({
      tier: "capable",
      kind: "chat",
      tripId: null,
      system: "s",
      messages: [{ role: "user", content: "x" }]
    });

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("loga métricas com tripId e kind", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "ok" }],
        finishReason: "stop",
        usage: { inputTokens: 100, outputTokens: 50 },
        warnings: []
      })
    });
    const { provider, calls } = providerWith(model);

    await provider.complete({
      tier: "capable",
      kind: "chat",
      tripId: "trip-42",
      system: "s",
      messages: [{ role: "user", content: "x" }]
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.tripId).toBe("trip-42");
    expect(calls[0]!.kind).toBe("chat");
    expect(calls[0]!.inputTokens).toBe(100);
  });

  it("escolhe o modelo pelo tier pedido", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: "ok" }],
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
        warnings: []
      })
    });
    const resolve = vi.fn(() => model);
    const provider = new AiSdkLlmProvider(resolve, "groq", { info: () => undefined });

    await provider.complete({
      tier: "cheap",
      kind: "extract",
      tripId: null,
      system: "s",
      messages: [{ role: "user", content: "x" }]
    });

    expect(resolve).toHaveBeenCalledWith("cheap");
  });
});

describe("AiSdkLlmProvider.completeStructured", () => {
  it("devolve o objeto validado pelo schema", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: "text", text: JSON.stringify({ picks: ["LIS"] }) }],
        finishReason: "stop",
        usage: { inputTokens: 4, outputTokens: 2 },
        warnings: []
      })
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
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd .worktrees/llm-provider-agnostico/apps/api
../../node_modules/.bin/vitest run src/llm/providers --coverage.enabled=false --pool=threads
```

Esperado: FAIL — o módulo `./ai-sdk.provider` não existe.

- [ ] **Step 3: Implementar**

Criar `apps/api/src/llm/providers/ai-sdk.provider.ts`:

```ts
import { generateObject, generateText, tool, type LanguageModel, type ModelMessage } from "ai";
import {
  estimateUsd,
  type LlmCompletion,
  type LlmCompletionRequest,
  type LlmLogger,
  type LlmMessage,
  type LlmProvider,
  type LlmStructuredRequest,
  type LlmTier,
  type LlmToolSpec
} from "../llm.types";

export type ModelResolver = (tier: LlmTier) => LanguageModel;

const MAX_TOKENS = 2048;

// Único arquivo do repo que importa `ai`. Se um major do SDK quebrar a API,
// o estrago fica aqui dentro.
export class AiSdkLlmProvider implements LlmProvider {
  constructor(
    private readonly resolveModel: ModelResolver,
    private readonly providerName: string,
    private readonly logger: LlmLogger
  ) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const startedAt = Date.now();
    const model = this.resolveModel(request.tier);

    const result = await generateText({
      model,
      system: request.system,
      messages: toModelMessages(request.messages),
      tools: request.tools === undefined ? undefined : toSdkTools(request.tools),
      maxOutputTokens: MAX_TOKENS
    });

    const usage = normalizeUsage(result.usage);
    const modelId = modelIdOf(model);
    this.log(request.kind, request.tripId, modelId, usage, startedAt);

    return {
      text: result.text,
      toolCalls: result.toolCalls.map((call) => ({
        id: call.toolCallId,
        name: call.toolName,
        args: (call.input ?? {}) as Record<string, unknown>
      })),
      model: modelId,
      usage
    };
  }

  async completeStructured<T>(request: LlmStructuredRequest<T>): Promise<T> {
    const startedAt = Date.now();
    const model = this.resolveModel(request.tier);

    const result = await generateObject({
      model,
      system: request.system,
      prompt: request.prompt,
      schema: request.schema
    });

    const usage = normalizeUsage(result.usage);
    this.log(request.kind, request.tripId, modelIdOf(model), usage, startedAt);

    return result.object as T;
  }

  private log(
    kind: string,
    tripId: string | null,
    model: string,
    usage: { inputTokens: number; outputTokens: number },
    startedAt: number
  ): void {
    this.logger.info({
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedUsd: estimateUsd(
        `${this.providerName}:${model}`,
        usage.inputTokens,
        usage.outputTokens
      ),
      kind,
      latencyMs: Date.now() - startedAt,
      tripId
    });
  }
}

// O SDK devolve tokens como number | undefined.
function normalizeUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
}): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0
  };
}

function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

// Nosso `parameters` vira o `inputSchema` do SDK.
function toSdkTools(specs: LlmToolSpec[]): Record<string, ReturnType<typeof tool>> {
  const entries = specs.map((spec) => [
    spec.name,
    tool({ description: spec.description, inputSchema: spec.parameters })
  ]);
  return Object.fromEntries(entries) as Record<string, ReturnType<typeof tool>>;
}

// Traduz nossas mensagens neutras para o formato de mensagem do SDK.
function toModelMessages(messages: LlmMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: message.toolCallId ?? "",
            toolName: message.name ?? "",
            output: { type: "text", value: message.content ?? "" }
          }
        ]
      } as ModelMessage;
    }

    if (message.role === "assistant" && message.toolCalls !== undefined) {
      return {
        role: "assistant",
        content: message.toolCalls.map((call) => ({
          type: "tool-call",
          toolCallId: call.id,
          toolName: call.name,
          input: call.args
        }))
      } as ModelMessage;
    }

    return { role: message.role, content: message.content ?? "" } as ModelMessage;
  });
}
```

**Nota para quem implementa:** `toModelMessages` usa `message.name` no ramo `tool`. Acrescentar `name?: string` a `LlmMessage` em `llm.types.ts` se ainda não estiver lá — o `ChatMessageDto` já carrega esse campo e o SDK precisa dele para casar o resultado com a tool.

- [ ] **Step 4: Rodar e ver passar**

```bash
../../node_modules/.bin/vitest run src/llm/providers --coverage.enabled=false --pool=threads
```

Esperado: PASS, 6 testes.

Se a forma do `MockLanguageModelV4` divergir (o SDK é recente e a API de mock mudou entre majors), ajustar o fixture do teste conforme `node_modules/ai/dist/test/index.d.ts` — **não** ajustar a implementação para caber num mock errado.

- [ ] **Step 5: Cobertura e mutação do pacote**

```bash
../../node_modules/.bin/vitest run --coverage.enabled=true --pool=threads
HOME=$PWD/.tmp-home ./node_modules/.bin/stryker run
```

Esperado: 100% de cobertura, mutação ≥ 90%.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/llm/providers apps/api/src/llm/llm.types.ts
git commit -m "feat(llm): AiSdkLlmProvider traduzindo a porta neutra para o AI SDK"
```

---

### Task 4: `LlmService` passa a falar a porta

Mata `extractJsonArray`, `extractJsonObject`, `parseRanking`, `parseItineraryOutput` e o retry manual. A saída passa a ser forçada por schema.

**Files:**
- Modify: `apps/api/src/llm/llm.service.ts`
- Modify: `apps/api/src/llm/llm.service.spec.ts`

**Interfaces:**
- Consumes: `LlmProvider`, `LlmStructuredRequest` (Task 2).
- Produces: `class LlmService implements LlmPort` — construtor `(provider: LlmProvider)`. `AnthropicLike` **deixa de existir**.

**Regra que sai do parser e vira regra de domínio:** "nenhum `iata` fora da shortlist". O schema não expressa isso; a checagem passa para dentro de `rankDestinations`, depois da chamada.

- [ ] **Step 1: Reescrever o spec**

Substituir `apps/api/src/llm/llm.service.spec.ts` inteiro:

```ts
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

function providerReturning(value: unknown): { provider: LlmProvider; structured: ReturnType<typeof vi.fn> } {
  const structured = vi.fn(() => Promise.resolve(value));
  const provider = {
    complete: vi.fn(),
    completeStructured: structured
  } as unknown as LlmProvider;
  return { provider, structured };
}

describe("LlmService.rankDestinations", () => {
  it("devolve o ranking validado pelo provider", async () => {
    const ranking = [
      { iata: "LIS", score: 0.9, rationale: RATIONALE },
      { iata: "OPO", score: 0.8, rationale: RATIONALE }
    ];
    const { provider } = providerReturning(ranking);

    await expect(new LlmService(provider).rankDestinations(input)).resolves.toEqual(ranking);
  });

  it("pede o tier capable e informa o kind", async () => {
    const { provider, structured } = providerReturning([
      { iata: "LIS", score: 0.9, rationale: RATIONALE }
    ]);

    await new LlmService(provider).rankDestinations(input);

    const request = structured.mock.calls[0]![0] as { tier: string; kind: string };
    expect(request.tier).toBe("capable");
    expect(request.kind).toBe("rank_destinations");
  });

  it("rejeita iata fora da shortlist com llm_invalid_output", async () => {
    const { provider } = providerReturning([{ iata: "GIG", score: 0.9, rationale: RATIONALE }]);

    try {
      await new LlmService(provider).rankDestinations(input);
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("llm_invalid_output");
    }
  });
});

describe("LlmService.buildItinerary", () => {
  it("devolve o roteiro do provider", async () => {
    const output = {
      days: [{ dayIndex: 1, slots: [{ slot: "morning", type: "activity", title: "Museu" }] }]
    };
    const { provider } = providerReturning(output);

    await expect(new LlmService(provider).buildItinerary(itineraryInput)).resolves.toEqual(output);
  });

  it("pede o tier capable e informa o kind", async () => {
    const { provider, structured } = providerReturning({
      days: [{ dayIndex: 1, slots: [] }]
    });

    await new LlmService(provider).buildItinerary(itineraryInput);

    const request = structured.mock.calls[0]![0] as { tier: string; kind: string };
    expect(request.tier).toBe("capable");
    expect(request.kind).toBe("build_itinerary");
  });
});

describe("LlmService.chat", () => {
  it("repassa system, mensagens e tools para o provider e devolve a completion", async () => {
    const completion = {
      text: "pronto",
      toolCalls: [],
      model: "m",
      usage: { inputTokens: 1, outputTokens: 1 }
    };
    const complete = vi.fn(() => Promise.resolve(completion));
    const provider = { complete, completeStructured: vi.fn() } as unknown as LlmProvider;

    const result = await new LlmService(provider).chat({
      system: "sys",
      messages: [{ role: "user", content: "oi" }],
      tools: [],
      tripId: "t-1"
    });

    expect(result).toEqual(completion);
    const request = complete.mock.calls[0]![0] as { tier: string; kind: string; tripId: string };
    expect(request.tier).toBe("capable");
    expect(request.kind).toBe("chat");
    expect(request.tripId).toBe("t-1");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
../../node_modules/.bin/vitest run src/llm/llm.service.spec.ts --coverage.enabled=false --pool=threads
```

Esperado: FAIL — `LlmService` ainda espera `AnthropicLike` e não tem `chat` com essa forma.

- [ ] **Step 3: Reescrever o serviço**

Substituir `apps/api/src/llm/llm.service.ts` inteiro:

```ts
import {
  DomainError,
  buildItineraryOutputSchema,
  llmRankingSchema,
  type BuildItineraryOutput,
  type LlmRanking
} from "@farol/shared";
import type {
  BuildItineraryInput,
  LlmChatInput,
  LlmCompletion,
  LlmPort,
  LlmProvider,
  RankDestinationsInput
} from "./llm.types";
import { RANK_SYSTEM, buildRankUserPrompt } from "./prompts/rank-destinations";
import { BUILD_ITINERARY_SYSTEM, buildItineraryUserPrompt } from "./prompts/build-itinerary";

// Regra de negócio da camada de LLM. Não conhece fornecedor nem biblioteca:
// fala só a porta. A saída é forçada por schema no provider, então aqui não há
// parser de JSON nem retry — o que sobra é regra de domínio.
export class LlmService implements LlmPort {
  constructor(private readonly provider: LlmProvider) {}

  async rankDestinations(input: RankDestinationsInput): Promise<LlmRanking> {
    const ranking = await this.provider.completeStructured({
      tier: "capable",
      kind: "rank_destinations",
      tripId: null,
      system: RANK_SYSTEM,
      prompt: buildRankUserPrompt(input),
      schema: llmRankingSchema
    });

    // O schema garante a forma; não garante que o modelo ficou dentro da
    // shortlist. Isso é regra de domínio, e o lugar dela é aqui.
    const allowed = new Set(input.shortlist.map((seed) => seed.iata));
    const strays = ranking.filter((item) => !allowed.has(item.iata)).map((item) => item.iata);
    if (strays.length > 0) {
      throw new DomainError(
        "llm_invalid_output",
        `o modelo escolheu destino fora da shortlist: ${strays.join(", ")}`
      );
    }

    return ranking;
  }

  buildItinerary(input: BuildItineraryInput): Promise<BuildItineraryOutput> {
    return this.provider.completeStructured({
      tier: "capable",
      kind: "build_itinerary",
      tripId: null,
      system: BUILD_ITINERARY_SYSTEM,
      prompt: buildItineraryUserPrompt(input),
      schema: buildItineraryOutputSchema
    });
  }

  chat(input: LlmChatInput): Promise<LlmCompletion> {
    return this.provider.complete({
      tier: "capable",
      kind: "chat",
      tripId: input.tripId,
      system: input.system,
      messages: input.messages,
      tools: input.tools
    });
  }
}
```

- [ ] **Step 4: Ajustar as assinaturas dos prompts**

`buildRankUserPrompt` e `buildItineraryUserPrompt` hoje recebem um segundo parâmetro `previousError` para o retry, que deixou de existir. Em `apps/api/src/llm/prompts/rank-destinations.ts` e `apps/api/src/llm/prompts/build-itinerary.ts`, remover o parâmetro e o trecho de prompt que o usava.

- [ ] **Step 5: Acrescentar `LlmChatInput` e `chat` ao `LlmPort`**

Em `apps/api/src/llm/llm.types.ts`:

```ts
export interface LlmChatInput {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolSpec[];
  tripId: string;
}

export interface LlmPort {
  rankDestinations(input: RankDestinationsInput): Promise<LlmRanking>;
  buildItinerary(input: BuildItineraryInput): Promise<BuildItineraryOutput>;
  chat(input: LlmChatInput): Promise<LlmCompletion>;
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
../../node_modules/.bin/vitest run src/llm --coverage.enabled=false --pool=threads
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/llm
git commit -m "refactor(llm): LlmService fala a porta neutra e usa saída estruturada"
```

---

### Task 5: `chat` entra na porta

`ChatService` deixa de injetar a classe concreta e para de montar blocos da Anthropic à mão.

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts`
- Modify: `apps/api/src/chat/chat.service.spec.ts`
- Modify: `apps/api/src/llm/fake-llm.service.ts`
- Modify: `apps/api/src/llm/fake-llm.service.spec.ts`

**Interfaces:**
- Consumes: `LLM` token, `LlmPort`, `LlmChatInput`, `LlmCompletion`, `LlmToolCall` (Tasks 2 e 4).
- Produces: `FakeLlmService` implementando os três métodos de `LlmPort`, com `chat` determinístico.

- [ ] **Step 1: Escrever o teste do fake que falha**

Acrescentar em `apps/api/src/llm/fake-llm.service.spec.ts`:

```ts
import { FakeLlmService } from "./fake-llm.service";

describe("FakeLlmService.chat", () => {
  it("devolve texto determinístico sem tool call por padrão", async () => {
    const result = await new FakeLlmService().chat({
      system: "s",
      messages: [{ role: "user", content: "oi" }],
      tools: [],
      tripId: "t-1"
    });
    expect(result.toolCalls).toEqual([]);
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("força uma tool call quando construído com nextToolCall", async () => {
    const fake = new FakeLlmService({
      nextToolCall: { id: "c-1", name: "set_budget", args: { total: 100 } }
    });

    const first = await fake.chat({ system: "s", messages: [], tools: [], tripId: "t-1" });
    expect(first.toolCalls).toEqual([{ id: "c-1", name: "set_budget", args: { total: 100 } }]);

    // A segunda chamada encerra o loop, senão o teste do ChatService roda até MAX_TURNS.
    const second = await fake.chat({ system: "s", messages: [], tools: [], tripId: "t-1" });
    expect(second.toolCalls).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
../../node_modules/.bin/vitest run src/llm/fake-llm.service.spec.ts --coverage.enabled=false --pool=threads
```

Esperado: FAIL — `chat` não existe no fake.

- [ ] **Step 3: Implementar o `chat` no fake**

Em `apps/api/src/llm/fake-llm.service.ts`, acrescentar:

```ts
import type { LlmChatInput, LlmCompletion, LlmToolCall } from "./llm.types";

export interface FakeLlmOptions {
  // Quando informado, a PRIMEIRA chamada de chat devolve esta tool call e as
  // seguintes devolvem texto — o suficiente para exercitar o loop sem travá-lo.
  nextToolCall?: LlmToolCall;
}
```

Dentro da classe `FakeLlmService`:

```ts
  private chatCalls = 0;

  constructor(private readonly options: FakeLlmOptions = {}) {}

  chat(input: LlmChatInput): Promise<LlmCompletion> {
    this.chatCalls += 1;
    const pending = this.options.nextToolCall;
    const shouldCallTool = pending !== undefined && this.chatCalls === 1;

    return Promise.resolve({
      text: shouldCallTool ? "" : `Resposta determinística de teste para ${input.tripId}.`,
      toolCalls: shouldCallTool ? [pending] : [],
      model: "fake-model",
      usage: { inputTokens: 0, outputTokens: 0 }
    });
  }
```

- [ ] **Step 4: Rodar e ver passar**

```bash
../../node_modules/.bin/vitest run src/llm/fake-llm.service.spec.ts --coverage.enabled=false --pool=threads
```

Esperado: PASS.

- [ ] **Step 5: Reescrever o loop do `ChatService`**

Em `apps/api/src/chat/chat.service.ts`, trocar o import e a injeção:

```ts
import { Inject, Injectable } from "@nestjs/common";
import { LLM, type LlmPort, type LlmMessage } from "../llm/llm.types";
```

```ts
  constructor(
    private readonly trips: TripsService,
    private readonly repo: ChatRepository,
    private readonly toolsService: ChatToolService,
    @Inject(LLM) private readonly llm: LlmPort
  ) {}
```

Substituir a montagem de `apiMessages` (o bloco que hoje cria `tool_result` / `tool_use`) por tradução direta, já que a porta tem a mesma forma do que está persistido:

```ts
    const apiMessages: LlmMessage[] = history.map((msg) => ({
      role: msg.role === "system" ? "user" : msg.role,
      content: msg.content ?? null,
      toolCalls: msg.toolCalls ?? undefined,
      toolCallId: msg.toolCallId ?? undefined,
      name: msg.name ?? undefined
    }));
```

Substituir o corpo do laço (a parte que lê `completion.content` e procura blocos) por:

```ts
    while (turns < MAX_TURNS) {
      turns++;

      const completion = await this.llm.chat({
        system,
        messages: apiMessages,
        tools: toolDefs,
        tripId
      });

      const call = completion.toolCalls[0];

      if (call === undefined) {
        const textContent = completion.text.length > 0 ? completion.text : "Ação concluída.";
        finalAssistantMsg = { role: "assistant", content: textContent };
        await this.repo.saveMessage(tripId, finalAssistantMsg);
        break;
      }

      const assistantToolMsg: ChatMessageDto = {
        role: "assistant",
        content: completion.text.length > 0 ? completion.text : null,
        toolCalls: [call]
      };
      await this.repo.saveMessage(tripId, assistantToolMsg);

      const toolResult = await this.toolsService.executeTool(userId, tripId, {
        name: call.name,
        args: call.args
      });

      const toolResultMsg: ChatMessageDto = {
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(toolResult)
      };
      await this.repo.saveMessage(tripId, toolResultMsg);

      apiMessages.push({ role: "assistant", content: null, toolCalls: [call] });
      apiMessages.push({
        role: "tool",
        content: JSON.stringify(toolResult),
        toolCallId: call.id,
        name: call.name
      });
    }
```

- [ ] **Step 6: Ajustar `chat.service.spec.ts`**

Trocar o mock do `LlmService` por `FakeLlmService` (ou por um objeto que implemente `LlmPort`), e trocar as asserções que hoje montam blocos `tool_use` por `toolCalls`. Usar `new FakeLlmService({ nextToolCall: ... })` para o caso que exercita a execução de tool.

- [ ] **Step 7: Rodar a suíte do chat**

```bash
source ../../.env
../../node_modules/.bin/vitest run src/chat --coverage.enabled=false --pool=threads
```

Esperado: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/chat apps/api/src/llm
git commit -m "refactor(chat): loop de tool-calling em cima da porta neutra"
```

---

### Task 6: Tools em zod

`chat-tools.types.ts` deixa de escrever JSON Schema à mão.

**Files:**
- Modify: `apps/api/src/chat/chat-tools.types.ts`
- Modify: `apps/api/src/chat/chat-tools.service.ts`
- Modify: `apps/api/src/chat/chat-tools.service.spec.ts`

**Interfaces:**
- Consumes: `LlmToolSpec` (Task 2).
- Produces: `CHAT_TOOLS: LlmToolSpec[]` com as **11** tools (`set_destination`, `shift_dates`, `set_budget`, `add_interest`, `remove_interest`, `regenerate_day`, `remove_item`, `pin_item`, `find_hotel`, `swap_restaurant`, `search_flights`). `ChatToolService.getToolDefinitions(): LlmToolSpec[]`.

**Atenção:** a spec original fala em "9 tools"; o código tem **11**. Converter as 11, não 9.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `apps/api/src/chat/chat-tools.service.spec.ts`:

```ts
import { CHAT_TOOLS } from "./chat-tools.types";

describe("CHAT_TOOLS", () => {
  it("expõe as 11 tools com parameters em zod", () => {
    expect(CHAT_TOOLS).toHaveLength(11);
    for (const spec of CHAT_TOOLS) {
      expect(typeof spec.name).toBe("string");
      expect(spec.description.length).toBeGreaterThan(0);
      expect(typeof spec.parameters.parse).toBe("function");
    }
  });

  it("set_destination valida iata", () => {
    const spec = CHAT_TOOLS.find((t) => t.name === "set_destination")!;
    expect(spec.parameters.safeParse({ iata: "LIS" }).success).toBe(true);
    expect(spec.parameters.safeParse({}).success).toBe(false);
  });

  it("set_budget exige número", () => {
    const spec = CHAT_TOOLS.find((t) => t.name === "set_budget")!;
    expect(spec.parameters.safeParse({ total: 5000 }).success).toBe(true);
    expect(spec.parameters.safeParse({ total: "muito" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
../../node_modules/.bin/vitest run src/chat/chat-tools.service.spec.ts --coverage.enabled=false --pool=threads
```

Esperado: FAIL — `parameters` não existe; hoje é `input_schema`.

- [ ] **Step 3: Converter as 11 tools**

Em `apps/api/src/chat/chat-tools.types.ts`, trocar a interface local pelo tipo da porta e converter cada `input_schema` para zod. Padrão da conversão:

```ts
import { z } from "zod";
import type { LlmToolSpec } from "../llm/llm.types";

export const CHAT_TOOLS: LlmToolSpec[] = [
  {
    name: "set_destination",
    description: "Escolhe ou altera o destino final da viagem pelo código IATA (ex: 'FOR', 'REC').",
    parameters: z.object({
      iata: z.string().describe("Código IATA do destino candidato")
    })
  },
  {
    name: "shift_dates",
    description: "Altera as datas da viagem ou a duração em dias.",
    parameters: z.object({
      dateStart: z.string().optional().describe("Data de início em YYYY-MM-DD"),
      dateEnd: z.string().optional().describe("Data de término em YYYY-MM-DD"),
      durationDays: z.number().optional().describe("Duração em dias")
    })
  },
  {
    name: "set_budget",
    description: "Define ou atualiza o orçamento total em R$ (BRL).",
    parameters: z.object({
      total: z.number().describe("Orçamento total em reais")
    })
  }
  // ... converter as 8 restantes seguindo o mesmo padrão:
  // campo em `required` do JSON Schema  → sem `.optional()`
  // campo fora de `required`            → com `.optional()`
  // "description" do campo              → `.describe(...)`
];
```

Converter as 8 restantes (`add_interest`, `remove_interest`, `regenerate_day`, `remove_item`, `pin_item`, `find_hotel`, `swap_restaurant`, `search_flights`) lendo o `input_schema` atual de cada uma no arquivo e aplicando as três regras acima. `search_flights` não tem propriedades: `parameters: z.object({})`.

Remover a interface `ChatToolDefinition` — `LlmToolSpec` a substitui.

- [ ] **Step 4: Ajustar `chat-tools.service.ts`**

Trocar o tipo de retorno:

```ts
import { CHAT_TOOLS } from "./chat-tools.types";
import type { LlmToolSpec } from "../llm/llm.types";
```

```ts
  getToolDefinitions(): LlmToolSpec[] {
    return CHAT_TOOLS;
  }
```

- [ ] **Step 5: Rodar e ver passar**

```bash
source ../../.env
../../node_modules/.bin/vitest run src/chat --coverage.enabled=false --pool=threads
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/chat
git commit -m "refactor(chat): definições de tool em zod no lugar de JSON Schema"
```

---

### Task 7: LLM desligável

Faz a aplicação subir sem nenhuma env de LLM. Sem isto, "provider trocável" continua
significando "obrigatório ter um provider pago configurado para o app existir".

**Files:**
- Create: `apps/api/src/llm/providers/disabled.provider.ts`
- Test: `apps/api/src/llm/providers/disabled.provider.spec.ts`
- Modify: `apps/api/src/common/domain-exception.filter.ts`
- Modify: `apps/api/src/common/domain-exception.filter.spec.ts`

**Interfaces:**
- Consumes: `LlmProvider`, `LlmCompletionRequest`, `LlmStructuredRequest` (Task 2).
- Produces: `class DisabledLlmProvider implements LlmProvider` — ambos os métodos lançam
  `DomainError("llm_not_configured", ...)`. Código `llm_not_configured` mapeado para **503**.

- [ ] **Step 1: Escrever os testes que falham**

Criar `apps/api/src/llm/providers/disabled.provider.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { isDomainError } from "@farol/shared";
import { DisabledLlmProvider } from "./disabled.provider";

const provider = new DisabledLlmProvider();

describe("DisabledLlmProvider", () => {
  it("complete lança llm_not_configured", async () => {
    try {
      await provider.complete({
        tier: "capable",
        kind: "chat",
        tripId: null,
        system: "s",
        messages: []
      });
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("llm_not_configured");
    }
  });

  it("completeStructured lança llm_not_configured", async () => {
    await expect(
      provider.completeStructured({
        tier: "capable",
        kind: "rank_destinations",
        tripId: null,
        system: "s",
        prompt: "p",
        schema: z.object({})
      })
    ).rejects.toMatchObject({ code: "llm_not_configured" });
  });
});
```

Acrescentar em `apps/api/src/common/domain-exception.filter.spec.ts`:

```ts
  it("mapeia llm_not_configured para 503", () => {
    const { host, status } = makeHost();
    new DomainExceptionFilter().catch(new DomainError("llm_not_configured", "sem LLM"), host);
    expect(status).toHaveBeenCalledWith(503);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd .worktrees/llm-provider-agnostico/apps/api
../../node_modules/.bin/vitest run src/llm/providers src/common --coverage.enabled=false --pool=threads
```

Esperado: FAIL nos dois arquivos.

- [ ] **Step 3: Implementar o provider desligado**

Criar `apps/api/src/llm/providers/disabled.provider.ts`:

```ts
import { DomainError } from "@farol/shared";
import type {
  LlmCompletion,
  LlmCompletionRequest,
  LlmProvider,
  LlmStructuredRequest
} from "../llm.types";

const MESSAGE =
  "recurso de IA não está configurado neste ambiente (defina LLM_PROVIDER, LLM_API_KEY, LLM_MODEL_CAPABLE e LLM_MODEL_CHEAP)";

// Usado quando não há env de LLM. Falha na chamada, não no boot: assim a app
// sobe inteira e só os fluxos que dependem de IA recusam (design §D4.1).
export class DisabledLlmProvider implements LlmProvider {
  complete(_request: LlmCompletionRequest): Promise<LlmCompletion> {
    return Promise.reject(new DomainError("llm_not_configured", MESSAGE));
  }

  completeStructured<T>(_request: LlmStructuredRequest<T>): Promise<T> {
    return Promise.reject(new DomainError("llm_not_configured", MESSAGE));
  }
}
```

**Nota:** o ESLint do projeto reprova parâmetro não usado com prefixo `_`. Se reclamar, usar
`complete(): Promise<LlmCompletion>` sem parâmetro nenhum — a assinatura continua compatível
com a interface em TypeScript.

- [ ] **Step 4: Mapear o código para 503**

Em `apps/api/src/common/domain-exception.filter.ts`, acrescentar ao `STATUS_BY_CODE`:

```ts
  llm_not_configured: HttpStatus.SERVICE_UNAVAILABLE,
```

- [ ] **Step 5: Rodar e ver passar**

```bash
../../node_modules/.bin/vitest run src/llm/providers src/common --coverage.enabled=false --pool=threads
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/llm/providers apps/api/src/common
git commit -m "feat(llm): DisabledLlmProvider para rodar a app sem LLM configurado"
```

---

### Task 8: Env, wiring e limpeza

Fecha o refactor: a troca de provider vira mudança de env, e a ausência de env desliga o LLM.

**Files:**
- Modify: `apps/api/src/config/env.schema.ts`
- Modify: `apps/api/src/config/env.schema.spec.ts`
- Modify: `apps/api/src/llm/llm.module.ts`
- Modify: `apps/api/package.json` (remover `@anthropic-ai/sdk`)
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`
- Modify: `apps/api/test/setup-e2e.ts`
- Modify: `apps/worker/test/generate.spec.ts`, `apps/worker/test/enrich.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `AiSdkLlmProvider`, `ModelResolver` (Task 3), `DisabledLlmProvider` (Task 7).
- Produces: env `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL_CAPABLE`, `LLM_MODEL_CHEAP` — todas **opcionais e interdependentes**; `ANTHROPIC_API_KEY` removida.

- [ ] **Step 1: Escrever os testes de env que falham**

Em `apps/api/src/config/env.schema.spec.ts`, **remover** `ANTHROPIC_API_KEY` do objeto `valid` sem pôr nada de LLM no lugar — o objeto `valid` passa a representar um ambiente sem IA, que precisa ser válido. Acrescentar:

```ts
const comLlm = {
  ...valid,
  LLM_PROVIDER: "groq",
  LLM_API_KEY: "chave-de-teste",
  LLM_MODEL_CAPABLE: "llama-3.3-70b-versatile",
  LLM_MODEL_CHEAP: "llama-3.1-8b-instant"
};

describe("env de LLM", () => {
  it("é válida sem nenhuma env de LLM (IA desligada)", () => {
    const env = parseEnv({ ...valid });
    expect(env.LLM_PROVIDER).toBeUndefined();
    expect(env.LLM_API_KEY).toBeUndefined();
  });

  it("aceita os três providers quando tudo está preenchido", () => {
    for (const provider of ["anthropic", "groq", "openai"]) {
      expect(parseEnv({ ...comLlm, LLM_PROVIDER: provider }).LLM_PROVIDER).toBe(provider);
    }
  });

  it("rejeita provider desconhecido", () => {
    expect(() => parseEnv({ ...comLlm, LLM_PROVIDER: "marte" })).toThrow(/LLM_PROVIDER/);
  });

  it("provider sem chave é erro de boot, não configuração pela metade", () => {
    const semChave: Record<string, string | undefined> = { ...comLlm };
    delete semChave.LLM_API_KEY;
    expect(() => parseEnv(semChave)).toThrow(/LLM_API_KEY/);
  });

  it("provider sem modelo capable é erro de boot", () => {
    const semModelo: Record<string, string | undefined> = { ...comLlm };
    delete semModelo.LLM_MODEL_CAPABLE;
    expect(() => parseEnv(semModelo)).toThrow(/LLM_MODEL_CAPABLE/);
  });

  it("provider sem modelo cheap é erro de boot", () => {
    const semModelo: Record<string, string | undefined> = { ...comLlm };
    delete semModelo.LLM_MODEL_CHEAP;
    expect(() => parseEnv(semModelo)).toThrow(/LLM_MODEL_CHEAP/);
  });

  it("chave sem provider é ignorada (IA segue desligada)", () => {
    const env = parseEnv({ ...valid, LLM_API_KEY: "solta" });
    expect(env.LLM_PROVIDER).toBeUndefined();
  });
});
```

Ajustar também o teste "lista os campos inválidos separados por vírgula": `ANTHROPIC_API_KEY` sai da lista de obrigatórias e nada de LLM entra.

- [ ] **Step 2: Rodar e ver falhar**

```bash
../../node_modules/.bin/vitest run src/config --coverage.enabled=false --pool=threads
```

Esperado: FAIL.

- [ ] **Step 3: Trocar o schema de env**

Em `apps/api/src/config/env.schema.ts`, remover a linha de `ANTHROPIC_API_KEY`, trocar as duas de modelo, e envolver o objeto num `superRefine`:

```ts
const baseEnvSchema = z.object({
  // ... todas as outras envs, inalteradas ...

  // LLM (design §D4.1). Todas opcionais: a aplicação sobe sem IA configurada.
  // Se LLM_PROVIDER vier, as outras três passam a ser obrigatórias — meia
  // configuração é erro de boot, não falha silenciosa no meio de um job.
  LLM_PROVIDER: z.enum(["anthropic", "groq", "openai"]).optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL_CAPABLE: z.string().min(1).optional(),
  LLM_MODEL_CHEAP: z.string().min(1).optional()
});

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.LLM_PROVIDER === undefined) {
    return;
  }
  for (const field of ["LLM_API_KEY", "LLM_MODEL_CAPABLE", "LLM_MODEL_CHEAP"] as const) {
    if (env[field] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} é obrigatória quando LLM_PROVIDER está definida`
      });
    }
  }
});
```

`parseEnv` não muda: já monta a mensagem a partir de `issue.path`, então o campo faltante aparece em `Env inválida: LLM_API_KEY`.

- [ ] **Step 4: Reescrever `llm.module.ts`**

Substituir `apps/api/src/llm/llm.module.ts` inteiro:

```ts
import { Global, Module } from "@nestjs/common";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { LLM, consoleLlmLogger, type LlmProvider, type LlmTier } from "./llm.types";
import { LlmService } from "./llm.service";
import { AiSdkLlmProvider, type ModelResolver } from "./providers/ai-sdk.provider";
import { DisabledLlmProvider } from "./providers/disabled.provider";

// Único lugar que conhece os três fornecedores. Trocar de provider é env.
// Sem LLM_PROVIDER, a IA fica desligada e a app sobe igual (design §D4.1).
function buildProvider(env: Env): LlmProvider {
  if (env.LLM_PROVIDER === undefined) {
    return new DisabledLlmProvider();
  }

  // O superRefine do schema garante que estas três existem quando há provider.
  const apiKey = env.LLM_API_KEY!;
  const modelByTier: Record<LlmTier, string> = {
    capable: env.LLM_MODEL_CAPABLE!,
    cheap: env.LLM_MODEL_CHEAP!
  };

  const factory = {
    anthropic: () => createAnthropic({ apiKey }),
    groq: () => createGroq({ apiKey }),
    openai: () => createOpenAI({ apiKey })
  }[env.LLM_PROVIDER]();

  const resolveModel: ModelResolver = (tier) => factory(modelByTier[tier]) as LanguageModel;

  return new AiSdkLlmProvider(resolveModel, env.LLM_PROVIDER, consoleLlmLogger);
}

@Global()
@Module({
  providers: [
    {
      provide: LLM,
      inject: [ENV],
      useFactory: (env: Env) => new LlmService(buildProvider(env))
    }
  ],
  exports: [LLM]
})
export class LlmModule {}
```

**Nota de cobertura:** `llm.module.ts` está na lista de exclusão do vitest (`src/**/*.module.ts`),
então `buildProvider` não conta para o gate de 100%. Se o revisor quiser essa lógica coberta,
mover `buildProvider` para `apps/api/src/llm/build-provider.ts` com spec próprio — decisão do
revisor, não obrigatória neste plano.

- [ ] **Step 5: Remover o SDK da Anthropic**

```bash
cd .worktrees/llm-provider-agnostico
pnpm --filter @farol/api remove @anthropic-ai/sdk
```

- [ ] **Step 6: Atualizar env em todos os lugares que a declaram**

Remover `ANTHROPIC_API_KEY` de:
- `.env.example` — pôr as quatro novas **comentadas**, com nota de que a app roda sem elas e de que preencher `LLM_PROVIDER` obriga as outras três
- `apps/api/test/setup-e2e.ts` — apenas remover; os e2e passam a rodar com IA desligada, porque nenhum deles exercita fluxo de LLM de verdade (usam `FakeLlmService`)
- `apps/worker/test/generate.spec.ts` e `apps/worker/test/enrich.spec.ts` — idem
- `.github/workflows/ci.yml`, bloco `env:` — remover `ANTHROPIC_API_KEY` e **não** pôr nada de LLM no lugar. O CI passa a exercitar o caminho "sem IA configurada", que é o default de quem clona o repo

Se algum teste quebrar por falta de env de LLM, é sinal de que ele dependia de config em vez do fake — corrigir o teste, não repor a env.

- [ ] **Step 7: Atualizar o README**

Na seção Setup do `README.md`:
- deixar explícito que **a aplicação roda sem nenhuma env de LLM**, e o que fica indisponível nesse modo (descoberta, roteiro, chat)
- as quatro envs novas e a regra de interdependência
- o aviso que hoje falta: **não há `dotenv`**, então `apps/api` e `apps/worker` exigem `source .env` antes de subir; `apps/web` lê `.env.local` sozinho
- `db:seed`, que a seção não menciona
- os três processos (`api`, `worker`, `web`)

- [ ] **Step 8: Suíte inteira**

```bash
source .env
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm test:mutation
```

Esperado: tudo verde, cobertura 100% por pacote, mutação ≥ 90%.

- [ ] **Step 9: Verificar que `@anthropic-ai/sdk` sumiu do código**

```bash
grep -rn "anthropic-ai/sdk\|AnthropicLike" apps packages --include=*.ts
```

Esperado: nenhum resultado fora de `llm.module.ts` (que importa `@ai-sdk/anthropic`, outro pacote).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(llm): troca de provider por env e remoção do SDK da Anthropic"
```

---

## Self-Review

**1. Cobertura da spec.**

| Requisito da spec | Task |
|---|---|
| D1 porta neutra (`LlmMessage`, `LlmToolSpec`, `LlmCompletion`, `LlmProvider`) | 2 |
| D2 AI SDK como implementação atrás da porta | 3 |
| D3 seleção por tier | 2 (tipo), 3 (uso), 7 (resolução) |
| D4 env `LLM_PROVIDER` / `LLM_API_KEY` / modelos sem default | 8 |
| D4.1 LLM opcional no boot; `llm_not_configured` → 503 | 7 (provider e filtro), 8 (env opcional e wiring) |
| D5 saída estruturada; morte de `extractJson*` e do retry | 4 |
| D6 `chat` na porta; `ChatService` injeta o token | 4 (porta), 5 (consumo) |
| D7 `tripId` no log e preço por `provider:model` | 2 (tipo/preço), 3 (log) |
| §6 testes: unidade, contrato do adaptador, integração, fake | 3 (contrato), 4 (unidade), 5 (fake e integração) |
| §7 risco do zod | 1, com gate explícito |
| §8 ordem de migração | Tasks 1–8 na mesma ordem |

Sem lacuna.

**2. Placeholders.** O único ponto que não traz o código inteiro é a Task 6 Step 3, que converte 3 das 11 tools e dá a regra mecânica para as 8 restantes (`required` → sem `.optional()`; `description` → `.describe()`). É repetição mecânica de um padrão já mostrado, com a fonte no próprio arquivo — não é decisão em aberto. Aceito de propósito para o plano não virar transcrição de 200 linhas de schema.

**3. Consistência de tipos.** `LlmToolCall { id, name, args }` é usado igual nas Tasks 2, 3 e 5. `LlmToolSpec.parameters` (nosso nome) vira `inputSchema` (nome do SDK) só dentro de `toSdkTools`, na Task 3 — a assimetria é deliberada e está comentada. `estimateUsd` mantém a assinatura da Task 2 e é chamada com a chave `provider:model` na Task 3. `LlmPort` ganha `chat` na Task 4 Step 5 e é consumido na Task 5.

**4. Achado registrado.** A spec original (`2026-08-27-mvp-trip-design.md` §6.4) descreve **9** tools; o código tem **11**. O plano converte as 11. Vale corrigir a spec original em separado — não faz parte deste refactor.
