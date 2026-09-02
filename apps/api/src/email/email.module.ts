import { Global, Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { EMAIL, type EmailPort } from "./email.types";
import { FakeEmailProvider } from "./fake-email.provider";
import { DisabledEmailProvider } from "./providers/disabled.provider";
import { ResendEmailProvider } from "./providers/resend.provider";

// Único lugar que conhece os providers de e-mail. Trocar de provider é env.
// Sem EMAIL_PROVIDER o envio fica desligado e a aplicação sobe igual.
export function buildEmail(env: Env): EmailPort {
  if (env.EMAIL_PROVIDER === "fake") {
    return new FakeEmailProvider();
  }
  if (env.EMAIL_PROVIDER === undefined) {
    return new DisabledEmailProvider();
  }
  // O superRefine do env.schema garante as duas quando há provider.
  return new ResendEmailProvider(env.EMAIL_API_KEY!, env.EMAIL_FROM!);
}

@Global()
@Module({
  providers: [{ provide: EMAIL, inject: [ENV], useFactory: (env: Env) => buildEmail(env) }],
  exports: [EMAIL]
})
export class EmailModule {}
