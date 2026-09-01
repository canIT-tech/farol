import { Global, Module } from "@nestjs/common";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { LLM, consoleLlmLogger, type LlmPort, type LlmProvider, type LlmTier } from "./llm.types";
import { LlmService } from "./llm.service";
import { FakeLlmService } from "./fake-llm.service";
import { AiSdkLlmProvider, type ModelResolver } from "./providers/ai-sdk.provider";
import { DisabledLlmProvider } from "./providers/disabled.provider";

// Único lugar que conhece os três fornecedores. Trocar de provider, ou trocar
// de modelo dentro do mesmo provider, é mudança de env.
// Sem LLM_PROVIDER a IA fica desligada e a aplicação sobe igual (§D4.1).
// LLM_PROVIDER=fake devolve o FakeLlmService direto, sem passar pelo LlmService:
// o E2E sobe a api como processo externo, onde overrideProvider não alcança.
export function buildLlm(env: Env): LlmPort {
  if (env.LLM_PROVIDER === "fake") {
    return new FakeLlmService();
  }
  return new LlmService(buildLlmProvider(env));
}

export function buildLlmProvider(env: Env): LlmProvider {
  if (env.LLM_PROVIDER === undefined || env.LLM_PROVIDER === "fake") {
    return new DisabledLlmProvider();
  }

  // O superRefine do env.schema garante que estas três existem quando há provider.
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

  const resolveModel: ModelResolver = (tier) => factory(modelByTier[tier]);

  return new AiSdkLlmProvider(resolveModel, env.LLM_PROVIDER, consoleLlmLogger);
}

@Global()
@Module({
  providers: [
    {
      provide: LLM,
      inject: [ENV],
      useFactory: (env: Env) => buildLlm(env)
    }
  ],
  exports: [LLM]
})
export class LlmModule {}
