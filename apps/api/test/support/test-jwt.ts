import { generateKeyPair, exportJWK, SignJWT, type JWK } from "jose";
import { createServer, type Server } from "node:http";

// Sobe um JWKS fake local: gera um par RSA, serve a chave pública e assina JWTs de teste.
// Nenhum teste de auth toca o Supabase real.
export interface FakeJwks {
  jwksUrl: string;
  sign: (claims: Record<string, unknown>, opts?: { expiresIn?: string }) => Promise<string>;
  stop: () => Promise<void>;
}

export async function startFakeJwks(): Promise<FakeJwks> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };

  const server: Server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    jwksUrl: `http://localhost:${port}/`,
    sign: (claims, opts) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuedAt()
        .setExpirationTime(opts?.expiresIn ?? "5m")
        .sign(privateKey),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}
