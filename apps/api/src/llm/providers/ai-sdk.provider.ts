import {
  generateObject,
  generateText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet
} from "ai";
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

export type ModelResolver = (tier: LlmTier) => Exclude<LanguageModel, string>;

const MAX_TOKENS = 2048;

type Usage = { inputTokens: number; outputTokens: number };

// O SDK devolve os tokens como number | undefined; sem o fallback o custo vira NaN.
function normalizeUsage(usage: { inputTokens?: number; outputTokens?: number }): Usage {
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0
  };
}

// O `parameters` da nossa porta vira o `inputSchema` do SDK. É a única
// assimetria de nome, e é deliberada: a porta não fala o dialeto da biblioteca.
function toSdkTools(specs: LlmToolSpec[]): ToolSet {
  // Sem o helper tool(): ele é identidade em runtime e existe só para inferir
  // tipos de tools escritas literalmente. Montando dinamicamente, os genéricos
  // dele estouram a profundidade de inferência do TS sem dar nada em troca.
  const entries = specs.map((spec) => [
    spec.name,
    { description: spec.description, inputSchema: spec.parameters }
  ]);
  return Object.fromEntries(entries) as ToolSet;
}

// generateObject é sobrecarregado e genérico no schema; InferSchema<T> estoura a
// profundidade de inferência do TS quando T é a variável genérica da porta.
// Esta assinatura estreita é a superfície que realmente usamos. O contrato de
// tipo continua garantido em runtime: o SDK valida a saída contra o schema.
type GenerateObjectLike = (options: {
  model: LanguageModel;
  system: string;
  prompt: string;
  schema: unknown;
  maxRetries: number;
}) => Promise<{ object: unknown; usage: { inputTokens?: number; outputTokens?: number } }>;

const generateObjectLoose = generateObject as unknown as GenerateObjectLike;

// O default do AI SDK é 2 tentativas, backoff exponencial: cerca de 6 s no
// total. A janela de tokens-por-minuto da Groq é de 60 s, então 429 por TPM
// esgotado desiste antes de a janela virar. 5 tentativas somam ~62 s e cobrem
// uma janela inteira.
// ponytail: retry cego; se a fila crescer, o certo é limitar taxa na origem
// (concorrência do pg-boss) em vez de esperar no provider.
const MAX_RETRIES = 5;

// Traduz as mensagens neutras para o formato do SDK.
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

// Único arquivo do repo que importa `ai`. Se um major do SDK quebrar a API,
// o estrago fica aqui dentro (design 2026-08-31, §D2).
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
      maxOutputTokens: MAX_TOKENS,
      maxRetries: MAX_RETRIES
    });

    const usage = normalizeUsage(result.usage);
    const modelId = model.modelId;
    this.log(request.kind, request.tripId, modelId, usage, startedAt);

    return {
      text: result.text,
      toolCalls: result.toolCalls.map((call) => ({
        id: call.toolCallId,
        name: call.toolName,
        args: call.input as Record<string, unknown>
      })),
      model: modelId,
      usage
    };
  }

  async completeStructured<T>(request: LlmStructuredRequest<T>): Promise<T> {
    const startedAt = Date.now();
    const model = this.resolveModel(request.tier);

    const result = await generateObjectLoose({
      model,
      system: request.system,
      prompt: request.prompt,
      schema: request.schema,
      maxRetries: MAX_RETRIES
    });

    const usage = normalizeUsage(result.usage);
    this.log(request.kind, request.tripId, model.modelId, usage, startedAt);

    return result.object as T;
  }

  private log(
    kind: string,
    tripId: string | null,
    model: string,
    usage: Usage,
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
