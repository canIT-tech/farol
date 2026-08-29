import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ZodValidationPipe } from "./zod.pipe";
import { isDomainError } from "@farol/shared";

const schema = z.object({
  nome: z.string().min(2),
  idade: z.number().int(),
  endereco: z.object({ cidade: z.string().min(2) })
});

describe("ZodValidationPipe", () => {
  it("devolve o valor parseado quando o payload é válido", () => {
    const pipe = new ZodValidationPipe(schema);
    const ok = { nome: "Ana", idade: 30, endereco: { cidade: "Recife" } };
    expect(pipe.transform(ok)).toEqual(ok);
  });

  it("lança ValidationError listando cada campo inválido separado por '; '", () => {
    const pipe = new ZodValidationPipe(schema);
    try {
      pipe.transform({ nome: "A", idade: 1.5, endereco: { cidade: "X" } });
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      const msg = (err as Error).message;
      expect(msg).toMatch(/^payload inválido: /);
      expect(msg).toContain("nome: ");
      expect(msg).toContain("idade: ");
      // path aninhado precisa aparecer com ponto
      expect(msg).toContain("endereco.cidade: ");
      // múltiplos erros são unidos por "; "
      expect(msg.split("; ").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("lança quando o valor não é um objeto", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform("nada")).toThrow("payload inválido");
  });
});
