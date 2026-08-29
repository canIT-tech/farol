import { describe, it, expect, vi } from "vitest";
import type { ArgumentsHost } from "@nestjs/common";
import { DomainError, NotFoundError, ForbiddenError, ValidationError } from "@farol/shared";
import { DomainExceptionFilter } from "./domain-exception.filter";

function makeHost() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) })
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe("DomainExceptionFilter", () => {
  it("mapeia NotFoundError para 404", () => {
    const { host, status, json } = makeHost();
    new DomainExceptionFilter().catch(new NotFoundError("sem perfil"), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, code: "not_found", message: "sem perfil" });
  });

  it("mapeia ValidationError para 400", () => {
    const { host, status } = makeHost();
    new DomainExceptionFilter().catch(new ValidationError("ruim"), host);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("mapeia ForbiddenError para 403", () => {
    const { host, status } = makeHost();
    new DomainExceptionFilter().catch(new ForbiddenError("nao pode"), host);
    expect(status).toHaveBeenCalledWith(403);
  });

  it("mapeia no_destinations_in_budget para 422", () => {
    const { host, status } = makeHost();
    new DomainExceptionFilter().catch(
      new DomainError("no_destinations_in_budget", "sem opções"),
      host
    );
    expect(status).toHaveBeenCalledWith(422);
  });

  it("mapeia llm_invalid_output para 502", () => {
    const { host, status } = makeHost();
    new DomainExceptionFilter().catch(new DomainError("llm_invalid_output", "modelo ruim"), host);
    expect(status).toHaveBeenCalledWith(502);
  });

  it("usa 400 para código de domínio sem mapeamento", () => {
    const { host, status, json } = makeHost();
    new DomainExceptionFilter().catch(new DomainError("outro", "estranho"), host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ statusCode: 400, code: "outro", message: "estranho" });
  });
});
