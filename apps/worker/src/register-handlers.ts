import type { INestApplicationContext } from "@nestjs/common";
import {
  JOB_NAMES,
  JOB_QUEUE,
  ItineraryGenerateHandler,
  type JobQueue
} from "@farol/api";
import type { ItineraryGenerateData } from "@farol/api";

// Liga cada nome de fila ao seu handler. Chamado uma vez no bootstrap do worker.
export async function registerHandlers(app: INestApplicationContext): Promise<void> {
  const queue = app.get<JobQueue>(JOB_QUEUE);
  const generate = app.get(ItineraryGenerateHandler);

  await queue.work<ItineraryGenerateData>(JOB_NAMES.itineraryGenerate, (data) =>
    generate.handle(data)
  );
}
