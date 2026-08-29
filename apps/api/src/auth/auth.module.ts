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
      useFactory: (env: Env) => new JwtVerifier(env.SUPABASE_JWKS_URL)
    },
    UserUpsertService,
    AuthGuard
  ],
  exports: [JwtVerifier, UserUpsertService, AuthGuard]
})
export class AuthModule {}
