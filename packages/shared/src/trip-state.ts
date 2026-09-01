import { z } from "zod";
import { destinationCandidateSchema } from "./discovery.js";
import { isoDateSchema, tripPartySchema, tripStatusEnum, yearMonthSchema } from "./trip.js";

// A viagem como a api devolve. Vive aqui, e não em apps/api, porque o apps/web
// precisa validar a resposta e não pode depender do back.
export const tripSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: tripStatusEnum,
  title: z.string().nullable(),
  originIata: z.string().length(3),
  dateStart: isoDateSchema.nullable(),
  dateEnd: isoDateSchema.nullable(),
  durationDays: z.number().int().nullable(),
  targetMonth: yearMonthSchema.nullable(),
  party: tripPartySchema,
  budgetTotal: z.number().nullable(),
  currency: z.string(),
  chosenDestinationId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Trip = z.infer<typeof tripSchema>;

// O que GET /trips/:id devolve: a viagem mais os candidatos de destino.
export const tripStateSchema = tripSchema.extend({
  destinations: z.array(destinationCandidateSchema),
  chosenDestination: destinationCandidateSchema.nullable()
});
export type TripState = z.infer<typeof tripStateSchema>;
