import { describe, it, expect, vi } from "vitest";
import type { INestApplicationContext } from "@nestjs/common";
import { ItineraryGenerateHandler } from "../itinerary/itinerary-generate.handler";
import { ItineraryRegenerateDayHandler } from "../itinerary/itinerary-regenerate-day.handler";
import { PlacesEnrichHandler } from "../itinerary/places-enrich.handler";
import { JOB_NAMES } from "./job-names";
import { JOB_QUEUE } from "./job-queue";
import { registerHandlers } from "./register-handlers";

function contextWith() {
  // Assinatura explicita para o mock.calls vir tipado e handlerFor nao precisar de cast.
  type Work = (name: string, handler: (data: unknown) => Promise<void>) => Promise<void>;
  const work = vi.fn<Work>(async () => {});
  const queue = { publish: vi.fn(), work };
  const generate = { handle: vi.fn(async () => {}) };
  const regenerateDay = { handle: vi.fn(async () => {}) };
  const placesEnrich = { handle: vi.fn(async () => {}) };

  const byToken = new Map<unknown, unknown>([
    [JOB_QUEUE, queue],
    [ItineraryGenerateHandler, generate],
    [ItineraryRegenerateDayHandler, regenerateDay],
    [PlacesEnrichHandler, placesEnrich]
  ]);

  const app = { get: (token: unknown) => byToken.get(token) } as INestApplicationContext;
  return { app, work, generate, regenerateDay, placesEnrich };
}

describe("registerHandlers", () => {
  it("registra as três filas", async () => {
    const { app, work } = contextWith();
    await registerHandlers(app);

    expect(work.mock.calls.map((c) => c[0])).toEqual([
      JOB_NAMES.itineraryGenerate,
      JOB_NAMES.itineraryRegenerateDay,
      JOB_NAMES.placesEnrich
    ]);
  });

  // O que este teste protege: fila apontando para o handler errado não quebra
  // build nem tipo — só processa o job errado, em silêncio.
  it("cada fila chama o handler dela", async () => {
    const { app, work, generate, regenerateDay, placesEnrich } = contextWith();
    await registerHandlers(app);

    const handlerFor = (name: string) =>
      work.mock.calls.find((c) => c[0] === name)![1];

    await handlerFor(JOB_NAMES.itineraryGenerate)({ itineraryId: "i-1" });
    expect(generate.handle).toHaveBeenCalledWith({ itineraryId: "i-1" });

    await handlerFor(JOB_NAMES.itineraryRegenerateDay)({ itineraryId: "i-1", dayIndex: 2 });
    expect(regenerateDay.handle).toHaveBeenCalledWith({ itineraryId: "i-1", dayIndex: 2 });

    await handlerFor(JOB_NAMES.placesEnrich)({ itineraryId: "i-1" });
    expect(placesEnrich.handle).toHaveBeenCalledWith({ itineraryId: "i-1" });

    expect(generate.handle).toHaveBeenCalledTimes(1);
  });
});
