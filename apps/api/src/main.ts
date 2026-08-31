import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { parseEnv } from "./config/env.schema";

async function bootstrap(): Promise<void> {
  const env = parseEnv(process.env);
  const app = await NestFactory.create(AppModule);
  // A landing pública (apps/web) chama /waitlist de outra origem.
  app.enableCors();
  await app.listen(env.API_PORT);
}

void bootstrap();
