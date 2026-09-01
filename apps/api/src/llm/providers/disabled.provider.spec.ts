import { describe, it, expect } from "vitest";
import { z } from "zod";
import { isDomainError } from "@farol/shared";
import { DisabledLlmProvider } from "./disabled.provider";

const provider = new DisabledLlmProvider();

describe("DisabledLlmProvider", () => {
  it("complete lança llm_not_configured", async () => {
    try {
      await provider.complete();
      expect.unreachable("deveria lançar");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("llm_not_configured");
    }
  });

  it("a mensagem diz quais envs faltam", async () => {
    await expect(provider.complete()).rejects.toThrow(/LLM_PROVIDER/);
    await expect(provider.complete()).rejects.toThrow(/LLM_MODEL_CAPABLE/);
  });

  it("completeStructured lança llm_not_configured", async () => {
    await expect(
      provider.completeStructured<z.infer<z.ZodObject<Record<string, never>>>>()
    ).rejects.toMatchObject({ code: "llm_not_configured" });
  });
});
