import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startFakeJwks, type FakeJwks } from "../../test/support/test-jwt";
import { JwtVerifier } from "./jwt-verifier";

let jwks: FakeJwks;
beforeAll(async () => {
  jwks = await startFakeJwks();
});
afterAll(() => jwks.stop());

describe("JwtVerifier", () => {
  it("aceita token válido e devolve sub/email", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com" });
    const verifier = new JwtVerifier(jwks.jwksUrl);
    await expect(verifier.verify(token)).resolves.toEqual({ sub: "u-1", email: "a@b.com" });
  });

  it("rejeita token com assinatura inválida", async () => {
    const verifier = new JwtVerifier(jwks.jwksUrl);
    await expect(verifier.verify("aaa.bbb.ccc")).rejects.toThrow("token inválido");
  });

  it("rejeita token expirado", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com" }, { expiresIn: "-1m" });
    const verifier = new JwtVerifier(jwks.jwksUrl);
    await expect(verifier.verify(token)).rejects.toThrow("token inválido");
  });

  it("rejeita token sem sub", async () => {
    const token = await jwks.sign({ email: "a@b.com" });
    const verifier = new JwtVerifier(jwks.jwksUrl);
    await expect(verifier.verify(token)).rejects.toThrow("token inválido");
  });

  it("rejeita token sem email", async () => {
    const token = await jwks.sign({ sub: "u-1" });
    const verifier = new JwtVerifier(jwks.jwksUrl);
    await expect(verifier.verify(token)).rejects.toThrow("token inválido");
  });

  it("rejeita token com email que não é string", async () => {
    const token = await jwks.sign({ sub: "u-1", email: 42 });
    const verifier = new JwtVerifier(jwks.jwksUrl);
    await expect(verifier.verify(token)).rejects.toThrow("token inválido");
  });
});
