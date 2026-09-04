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

describe("JwtVerifier e a audiência", () => {
  // O Supabase emite aud "authenticated" para token de usuário. Sem a checagem,
  // qualquer token assinado pela mesma chave do projeto passaria — inclusive um
  // que não represente uma pessoa logada.
  it("aceita o token com a audiência esperada", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com", aud: "authenticated" });
    const verifier = new JwtVerifier(jwks.jwksUrl, "authenticated");
    await expect(verifier.verify(token)).resolves.toEqual({ sub: "u-1", email: "a@b.com" });
  });

  it("recusa o token com outra audiência", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com", aud: "outra-coisa" });
    const verifier = new JwtVerifier(jwks.jwksUrl, "authenticated");
    await expect(verifier.verify(token)).rejects.toThrow(/token inválido/);
  });

  it("recusa o token sem audiência", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com", aud: undefined });
    const verifier = new JwtVerifier(jwks.jwksUrl, "authenticated");
    await expect(verifier.verify(token)).rejects.toThrow(/token inválido/);
  });

  // Sem audiência configurada, não verifica — mantém o comportamento anterior
  // para quem roda contra um emissor que não use a convenção do Supabase.
  it("não verifica audiência quando não há uma configurada", async () => {
    const token = await jwks.sign({ sub: "u-1", email: "a@b.com", aud: undefined });
    await expect(new JwtVerifier(jwks.jwksUrl).verify(token)).resolves.toMatchObject({ sub: "u-1" });
  });
});
