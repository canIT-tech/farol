import { describe, it, expect } from "vitest";
import type { Env } from "../config/env.schema";
import { buildEmail } from "./email.module";
import { FakeEmailProvider } from "./fake-email.provider";
import { DisabledEmailProvider } from "./providers/disabled.provider";
import { ResendEmailProvider } from "./providers/resend.provider";

describe("buildEmail", () => {
  it("sem EMAIL_PROVIDER devolve o desligado", () => {
    expect(buildEmail({} as Env)).toBeInstanceOf(DisabledEmailProvider);
  });

  it("fake devolve o provider em memória", () => {
    expect(buildEmail({ EMAIL_PROVIDER: "fake" } as Env)).toBeInstanceOf(FakeEmailProvider);
  });

  it("resend devolve o adapter da Resend", () => {
    const env = { EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_x", EMAIL_FROM: "oi@farol.app" } as Env;
    expect(buildEmail(env)).toBeInstanceOf(ResendEmailProvider);
  });
});
