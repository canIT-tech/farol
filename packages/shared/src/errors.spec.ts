import { describe, it, expect } from "vitest";
import { DomainError, NotFoundError, ForbiddenError, ValidationError, isDomainError } from "./errors";

describe("erros de domínio", () => {
  it("DomainError carrega code e message", () => {
    const e = new DomainError("trip_not_found", "viagem não encontrada");
    expect(e.code).toBe("trip_not_found");
    expect(e.message).toBe("viagem não encontrada");
    expect(e).toBeInstanceOf(Error);
  });

  it("subclasses fixam o code", () => {
    expect(new NotFoundError("x").code).toBe("not_found");
    expect(new ForbiddenError("x").code).toBe("forbidden");
    expect(new ValidationError("x").code).toBe("validation");
  });

  it("subclasses preservam o name e a message", () => {
    const e = new ValidationError("campo inválido");
    expect(e.name).toBe("ValidationError");
    expect(e.message).toBe("campo inválido");
    expect(isDomainError(e)).toBe(true);
  });

  it("isDomainError discrimina", () => {
    expect(isDomainError(new NotFoundError("x"))).toBe(true);
    expect(isDomainError(new Error("x"))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });
});
