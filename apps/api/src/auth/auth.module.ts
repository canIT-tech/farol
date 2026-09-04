import { Global, Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { JwtVerifier } from "./jwt-verifier";
import { UserUpsertService } from "./user-upsert.service";
import { AuthGuard } from "./auth.guard";

@Global()
@Module({
  providers: [
    {
      provide: JwtVerifier,
      inject: [ENV],
      // Aud vazia desliga a checagem — escape para um emissor que não siga a
      // convenção do Supabase.
      useFactory: (env: Env) =>
        new JwtVerifier(
          env.SUPABASE_JWKS_URL,
          env.SUPABASE_JWT_AUD === "" ? undefined : env.SUPABASE_JWT_AUD
        )
    },
    UserUpsertService,
    AuthGuard
  ],
  exports: [JwtVerifier, UserUpsertService, AuthGuard]
})
export class AuthModule {}
