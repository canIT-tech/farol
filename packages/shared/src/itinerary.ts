import { z } from "zod";

export const slotEnum = z.enum(["morning", "afternoon", "evening"]);
export const itemTypeEnum = z.enum(["activity", "meal", "transfer", "free"]);
export const itineraryStatusEnum = z.enum(["pending", "ready", "failed"]);
export type Slot = z.infer<typeof slotEnum>;
export type ItemType = z.infer<typeof itemTypeEnum>;
export type ItineraryStatus = z.infer<typeof itineraryStatusEnum>;

// Item de um dia como a api devolve ao web (design §5.1).
export const itineraryItemSchema = z.object({
  id: z.string().uuid(),
  slot: slotEnum,
  type: itemTypeEnum,
  title: z.string().min(1),
  description: z.string().nullable(),
  placeId: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating: z.number().nullable(),
  durationMin: z.number().int().nullable(),
  estCost: z.number().nullable(),
  sortOrder: z.number().int(),
  pinned: z.boolean()
});
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;

export const itineraryDaySchema = z.object({
  id: z.string().uuid(),
  dayIndex: z.number().int().min(1),
  date: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(itineraryItemSchema)
});
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;

export const itinerarySchema = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  version: z.number().int().min(1),
  status: itineraryStatusEnum,
  error: z.string().nullable(),
  generatedAt: z.string().nullable(),
  days: z.array(itineraryDaySchema)
});
export type Itinerary = z.infer<typeof itinerarySchema>;

// Forma exata que o Claude devolve na geração de roteiro (design §6.3).
export const buildItinerarySlotSchema = z.object({
  slot: slotEnum,
  type: itemTypeEnum,
  title: z.string().min(2).max(120),
  description: z.string().max(400).optional(),
  durationMin: z.number().int().positive().optional(),
  estCost: z.number().nonnegative().optional()
});
export const buildItineraryOutputSchema = z.object({
  days: z
    .array(
      z.object({
        dayIndex: z.number().int(),
        slots: z.array(buildItinerarySlotSchema)
      })
    )
    .min(1)
});
export type BuildItinerarySlot = z.infer<typeof buildItinerarySlotSchema>;
export type BuildItineraryOutput = z.infer<typeof buildItineraryOutputSchema>;

// Body de POST /trips/:id/destination.
export const chooseDestinationSchema = z.object({ iata: z.string().length(3) });
export type ChooseDestinationInput = z.infer<typeof chooseDestinationSchema>;
