import { describe, it, expect } from "vitest";
import { Controller, Get } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC, Public } from "./public.decorator";

@Controller("aberto")
class AbertoController {
  @Get()
  @Public()
  livre(): string {
    return "ok";
  }

  @Get("fechado")
  protegido(): string {
    return "ok";
  }
}

@Controller("tudo-aberto")
@Public()
class TudoAbertoController {
  @Get()
  livre(): string {
    return "ok";
  }
}

describe("@Public", () => {
  const reflector = new Reflector();

  it("marca o método", () => {
    expect(reflector.get(IS_PUBLIC, AbertoController.prototype.livre)).toBe(true);
  });

  it("marca a classe inteira", () => {
    expect(reflector.get(IS_PUBLIC, TudoAbertoController)).toBe(true);
  });

  // O silêncio é o padrão, e é o ponto de toda a mudança: rota que não diz nada
  // fica protegida. Antes era o contrário — quem esquecia o @UseGuards abria a
  // rota sem que nada acusasse.
  it("não marca quem não pediu", () => {
    expect(reflector.get(IS_PUBLIC, AbertoController.prototype.protegido)).toBeUndefined();
  });
});
