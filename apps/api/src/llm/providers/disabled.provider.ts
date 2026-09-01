import { DomainError } from "@farol/shared";
import type { LlmCompletion, LlmProvider } from "../llm.types";

const MESSAGE =
  "recurso de IA não está configurado neste ambiente (defina LLM_PROVIDER, LLM_API_KEY, LLM_MODEL_CAPABLE e LLM_MODEL_CHEAP)";

// Usado quando não há env de LLM. Falha na chamada, não no boot: assim a
// aplicação sobe inteira e só os fluxos que dependem de IA recusam
// (design 2026-08-31, §D4.1).
export class DisabledLlmProvider implements LlmProvider {
  complete(): Promise<LlmCompletion> {
    return Promise.reject(new DomainError("llm_not_configured", MESSAGE));
  }

  completeStructured<T>(): Promise<T> {
    return Promise.reject(new DomainError("llm_not_configured", MESSAGE));
  }
}
