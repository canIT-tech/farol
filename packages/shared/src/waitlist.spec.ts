import { describe, it, expect } from "vitest";
import {
  waitlistSignupSchema,
  waitlistSignupResultSchema,
  waitlistCountSchema
} from "./waitlist.js";

describe("waitlistSignupSchema", () => {
  it("aceita um e-mail válido sem source", () => {
    const r = waitlistSignupSchema.parse({ email: "ana@farol.app" });
    expect(r).toEqual({ email: "ana@farol.app" });
  });

  it("normaliza o e-mail (trim + lowercase)", () => {
    const r = waitlistSignupSchema.parse({ email: "  ANA@Farol.APP  " });
    expect(r.email).toBe("ana@farol.app");
  });

  it("aceita source e faz trim", () => {
    const r = waitlistSignupSchema.parse({ email: "ana@farol.app", source: "  landing-hero  " });
    expect(r.source).toBe("landing-hero");
  });

  it("rejeita e-mail inválido", () => {
    expect(waitlistSignupSchema.safeParse({ email: "não-é-email" }).success).toBe(false);
  });

  it("rejeita e-mail acima de 320 caracteres", () => {
    const email = `${"a".repeat(320)}@x.com`;
    expect(waitlistSignupSchema.safeParse({ email }).success).toBe(false);
  });

  it("rejeita source vazio", () => {
    expect(
      waitlistSignupSchema.safeParse({ email: "ana@farol.app", source: "   " }).success
    ).toBe(false);
  });

  it("rejeita source acima de 60 caracteres", () => {
    expect(
      waitlistSignupSchema.safeParse({ email: "ana@farol.app", source: "s".repeat(61) }).success
    ).toBe(false);
  });
});

describe("waitlistSignupResultSchema", () => {
  it("aceita ok=true com created booleano", () => {
    expect(waitlistSignupResultSchema.parse({ ok: true, created: false })).toEqual({
      ok: true,
      created: false
    });
  });

  it("rejeita ok=false", () => {
    expect(waitlistSignupResultSchema.safeParse({ ok: false, created: true }).success).toBe(false);
  });

  it("rejeita created ausente", () => {
    expect(waitlistSignupResultSchema.safeParse({ ok: true }).success).toBe(false);
  });
});

describe("waitlistCountSchema", () => {
  it("aceita contagem inteira não negativa", () => {
    expect(waitlistCountSchema.parse({ count: 12 })).toEqual({ count: 12 });
  });

  it("rejeita contagem negativa", () => {
    expect(waitlistCountSchema.safeParse({ count: -1 }).success).toBe(false);
  });

  it("rejeita contagem fracionária", () => {
    expect(waitlistCountSchema.safeParse({ count: 1.5 }).success).toBe(false);
  });
});
