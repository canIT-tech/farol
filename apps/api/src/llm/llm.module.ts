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
    }
  ],
  exports: [LLM]
})
export class LlmModule {}
