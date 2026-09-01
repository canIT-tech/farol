import { Global, Module } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { LLM, consoleLlmLogger } from "./llm.types";
import { LlmService, type AnthropicLike } from "./llm.service";

@Global()
@Module({
  providers: [
    {
      provide: LLM,
      inject: [ENV],
      useFactory: (env: Env) =>
        new LlmService(
          new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) as unknown as AnthropicLike,
          env.LLM_MODEL_CAPABLE,
          consoleLlmLogger
        )
    },
    // ChatService injeta a classe concreta em vez do token LLM (Passo 7).
    // Alias para a mesma instância; o refactor da porta neutra remove isto.
    { provide: LlmService, useExisting: LLM }
  ],
  exports: [LLM, LlmService]
})
export class LlmModule {}
