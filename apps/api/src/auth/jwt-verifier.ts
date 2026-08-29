import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { UnauthorizedException } from "@nestjs/common";

// Verifica o JWT do Supabase contra o JWKS (chaves em cache pelo jose, refetch em kid novo).
// A api é stateless: nada de sessão — só valida assinatura + exp e extrai sub/email.
export class JwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(jwksUrl: string) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verify(token: string): Promise<{ sub: string; email: string }> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks));
    } catch {
      throw new UnauthorizedException("token inválido");
    }
    if (typeof payload.sub === "string" && typeof payload.email === "string") {
      return { sub: payload.sub, email: payload.email };
    }
    throw new UnauthorizedException("token inválido");
  }
}
