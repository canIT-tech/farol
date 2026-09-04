import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { UnauthorizedException } from "@nestjs/common";

// Verifica o JWT do Supabase contra o JWKS (chaves em cache pelo jose, refetch em kid novo).
// A api é stateless: nada de sessão — só valida assinatura + exp + aud e extrai sub/email.
//
// Não verificamos `issuer` de propósito: o JWKS traz só a chave deste projeto,
// então um token de outro emissor já falha na assinatura. A checagem não
// acrescentaria segurança e acrescentaria uma forma de derrubar todo o login se
// o valor esperado divergisse do emitido.
export class JwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  /** @param audience `aud` exigido. O Supabase emite "authenticated" para token
   *  de usuário; sem isso, qualquer token assinado pela mesma chave do projeto
   *  passaria, inclusive um que não represente uma pessoa logada. Ausente,
   *  não verifica — para emissor que não siga a convenção. */
  constructor(
    jwksUrl: string,
    private readonly audience?: string
  ) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verify(token: string): Promise<{ sub: string; email: string }> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, {
        ...(this.audience === undefined ? {} : { audience: this.audience })
      }));
    } catch {
      throw new UnauthorizedException("token inválido");
    }
    if (typeof payload.sub === "string" && typeof payload.email === "string") {
      return { sub: payload.sub, email: payload.email };
    }
    throw new UnauthorizedException("token inválido");
  }
}
