import { describe, it, expect } from "vitest";
import { MeController } from "./me.controller";

describe("MeController", () => {
  it("devolve o usuário autenticado recebido do decorator", () => {
    const user = { id: "u-1", email: "a@b.com" };
    expect(new MeController().me(user)).toEqual(user);
  });
});
