import { describe, it, expect } from "vitest";
import { isDomainError } from "@farol/shared";
import { DisabledEmailProvider } from "./disabled.provider";

describe("DisabledEmailProvider", () => {
  it("rejeita com email_not_configured e a dica das envs", async () => {
    const provider = new DisabledEmailProvider();
    const err = await provider.send().catch((e: unknown) => e);
    expect(isDomainError(err)).toBe(true);
    expect((err as { code: string }).code).toBe("email_not_configured");
    expect((err as Error).message).toBe(
      "envio de e-mail não está configurado neste ambiente (defina EMAIL_PROVIDER, EMAIL_API_KEY e EMAIL_FROM)"
    );
  });
});
