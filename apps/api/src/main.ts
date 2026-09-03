import "reflect-metadata";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { parseEnv, type Env } from "./config/env.schema";
import { registerHandlers } from "./jobs/register-handlers";

// Prefixo de todas as rotas da api. Existe por causa do deploy de serviço
// único: sem ele `GET /trips/:id` (rota da api) colide com `/trips/[id]/...`
// (página do Next). O apps/web aponta NEXT_PUBLIC_API_URL para /api.
const API_PREFIX = "api";

// Serve o apps/web já construído como catch-all. Só entra quando SERVE_WEB=true,
// para o desenvolvimento e o boot smoke não precisarem de .next nenhum.
async function serveWeb(app: NestExpressApplication): Promise<void> {
  const { default: next } = await import("next");
  const nextApp = next({ dev: false, dir: resolve(__dirname, "../../web") });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();

  // Guarda pelo prefixo em vez de depender da ordem do middleware: qualquer
  // caminho que não seja da api vai para o Next.
  app.use((req: { url: string }, res: unknown, nextFn: () => void) => {
    if (req.url.startsWith(`/${API_PREFIX}`)) {
      nextFn();
      return;
    }
    void handle(req as never, res as never);
  });
}

async function bootstrap(): Promise<void> {
  const env: Env = parseEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix(API_PREFIX);
  // Atrás do proxy do Render, req.ip é o IP do próprio proxy — e o /whereami
  // sugeriria a cidade do datacenter para todo mundo. Com um salto de
  // confiança, req.ip passa a ser o último endereço do X-Forwarded-For.
  // Esse cabeçalho é falsificável, então o valor só serve para o palpite de
  // origem no onboarding — nunca para autorizar nada.
  app.set("trust proxy", 1);
  // A landing pública chama /waitlist de outra origem quando web e api estão
  // separados. No serviço único a origem é a mesma e isto não custa nada.
  app.enableCors();

  if (env.SERVE_WEB === "true") {
    await serveWeb(app);
  }

  await app.init();

  if (env.RUN_JOB_HANDLERS === "true") {
    await registerHandlers(app);
  }

  await app.listen(env.API_PORT);
}

void bootstrap();
