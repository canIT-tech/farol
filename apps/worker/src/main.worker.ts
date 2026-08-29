import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";
import { registerHandlers } from "./register-handlers";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: false });
  await registerHandlers(app);
  console.log(JSON.stringify({ event: "worker_ready" }));
}

void bootstrap();
