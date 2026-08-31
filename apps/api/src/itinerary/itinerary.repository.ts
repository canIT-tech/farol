import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  itineraries,
  itineraryDays,
  itineraryItems,
  tasteProfiles,
  tripDestinations,
  trips,
  type Database
} from "@farol/db";
import { nightsOf } from "@farol/domain";
import {
  itinerarySchema,
  itineraryItemSchema,
  type BuildItineraryOutput,
  type Itinerary,
  type ItineraryItem
} from "@farol/shared";
import type { BuildItineraryInput, PinnedItem } from "../llm/llm.types";
import { DB } from "../db/db.module";

type ItineraryRow = typeof itineraries.$inferSelect;
type ItemRow = typeof itineraryItems.$inferSelect;

function num(value: string | null): number | null {
  return value === null ? null : Number(value);
}

// Linha do banco → DTO que a api devolve. Compartilhado por latest() e swapRestaurant().
export function toItineraryItem(item: ItemRow): ItineraryItem {
  return itineraryItemSchema.parse({
    id: item.id,
    slot: item.slot,
    type: item.type,
    title: item.title,
    description: item.description,
    placeId: item.placeId,
    lat: num(item.lat),
    lng: num(item.lng),
    rating: num(item.rating),
    durationMin: item.durationMin,
    estCost: num(item.estCost),
    sortOrder: item.sortOrder,
    pinned: item.pinned
  });
}

@Injectable()
export class ItineraryRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async maxVersion(tripId: string): Promise<number> {
    const rows = await this.db
      .select({ max: sql<number>`coalesce(max(${itineraries.version}), 0)` })
      .from(itineraries)
      .where(eq(itineraries.tripId, tripId));
    return Number(rows[0]!.max);
  }

  async createPending(tripId: string, version: number): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.insert(itineraries).values({ id, tripId, version, status: "pending" });
    return id;
  }

  async markChosen(tripId: string, iata: string): Promise<void> {
    await this.db
      .update(tripDestinations)
      .set({ chosen: false })
      .where(eq(tripDestinations.tripId, tripId));
    const chosen = await this.db
      .update(tripDestinations)
      .set({ chosen: true })
      .where(and(eq(tripDestinations.tripId, tripId), eq(tripDestinations.iata, iata)))
      .returning({ id: tripDestinations.id });
    await this.db
      .update(trips)
      .set({ chosenDestinationId: chosen[0]!.id, updatedAt: new Date() })
      .where(eq(trips.id, tripId));
  }

  async getById(itineraryId: string): Promise<ItineraryRow | null> {
    const rows = await this.db.select().from(itineraries).where(eq(itineraries.id, itineraryId));
    return rows[0] ?? null;
  }

  async latest(tripId: string): Promise<Itinerary | null> {
    const itRows = await this.db
      .select()
      .from(itineraries)
      .where(eq(itineraries.tripId, tripId))
      .orderBy(desc(itineraries.version))
      .limit(1);
    const it = itRows[0];
    if (!it) {
      return null;
    }
    const dayRows = await this.db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.itineraryId, it.id))
      .orderBy(itineraryDays.dayIndex);
    const itemRows = await this.db
      .select()
      .from(itineraryItems)
      .where(
        sql`${itineraryItems.dayId} in (select ${itineraryDays.id} from ${itineraryDays} where ${itineraryDays.itineraryId} = ${it.id})`
      )
      .orderBy(itineraryItems.sortOrder);

    return itinerarySchema.parse({
      id: it.id,
      tripId: it.tripId,
      version: it.version,
      status: it.status,
      error: it.error,
      generatedAt: it.generatedAt ? it.generatedAt.toISOString() : null,
      days: dayRows.map((day) => ({
        id: day.id,
        dayIndex: day.dayIndex,
        date: day.date,
        notes: day.notes,
        items: itemRows.filter((item) => item.dayId === day.id).map(toItineraryItem)
      }))
    });
  }

  // Contexto de geração: destino escolhido + perfil + noites + itens pinned da versão anterior.
  async generationContext(
    tripId: string,
    version: number
  ): Promise<BuildItineraryInput & { pinned: PinnedItem[] }> {
    const tripRows = await this.db.select().from(trips).where(eq(trips.id, tripId));
    const trip = tripRows[0];
    if (!trip) {
      throw new Error(`viagem ${tripId} não existe`);
    }
    const destRows = await this.db
      .select()
      .from(tripDestinations)
      .where(and(eq(tripDestinations.tripId, tripId), eq(tripDestinations.chosen, true)));
    const dest = destRows[0];
    if (!dest) {
      throw new Error(`viagem ${tripId} não tem destino escolhido`);
    }
    const profileRows = await this.db
      .select()
      .from(tasteProfiles)
      .where(eq(tasteProfiles.userId, trip.userId));
    const profile = profileRows[0];
    if (!profile) {
      throw new Error(`usuário ${trip.userId} não tem perfil de gosto`);
    }

    return {
      destination: { city: dest.city, country: dest.country },
      nights: nightsOf({
        durationDays: trip.durationDays,
        dateStart: trip.dateStart,
        dateEnd: trip.dateEnd,
        budgetTotal: 0,
        party: { adults: trip.party.adults }
      }),
      pace: profile.pace as BuildItineraryInput["pace"],
      interests: profile.interests,
      party: trip.party,
      pinned: await this.pinnedFromVersion(tripId, version - 1)
    };
  }

  private async pinnedFromVersion(tripId: string, version: number): Promise<PinnedItem[]> {
    if (version < 1) {
      return [];
    }
    const rows = await this.db
      .select({
        dayIndex: itineraryDays.dayIndex,
        slot: itineraryItems.slot,
        type: itineraryItems.type,
        title: itineraryItems.title
      })
      .from(itineraryItems)
      .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
      .innerJoin(itineraries, eq(itineraryDays.itineraryId, itineraries.id))
      .where(
        and(
          eq(itineraries.tripId, tripId),
          eq(itineraries.version, version),
          eq(itineraryItems.pinned, true)
        )
      );
    return rows.map((row) => ({
      dayIndex: row.dayIndex,
      slot: row.slot as PinnedItem["slot"],
      type: row.type as PinnedItem["type"],
      title: row.title
    }));
  }

  // Substitui os dias/itens da versão atual (idempotente por itineraryId).
  async replaceDays(
    itineraryId: string,
    days: BuildItineraryOutput["days"],
    pinned: PinnedItem[]
  ): Promise<void> {
    const isPinned = new Set(
      pinned.map((p) => `${p.dayIndex}|${p.slot}|${p.type}|${p.title}`)
    );
    await this.db.transaction(async (tx) => {
      await tx.delete(itineraryDays).where(eq(itineraryDays.itineraryId, itineraryId));
      for (const day of days) {
        const dayId = crypto.randomUUID();
        await tx.insert(itineraryDays).values({ id: dayId, itineraryId, dayIndex: day.dayIndex });
        if (day.slots.length > 0) {
          await tx.insert(itineraryItems).values(
            day.slots.map((slot, index) => ({
              id: crypto.randomUUID(),
              dayId,
              slot: slot.slot,
              type: slot.type,
              title: slot.title,
              description: slot.description ?? null,
              durationMin: slot.durationMin ?? null,
              estCost: slot.estCost === undefined ? null : String(slot.estCost),
              sortOrder: index,
              pinned: isPinned.has(`${day.dayIndex}|${slot.slot}|${slot.type}|${slot.title}`)
            }))
          );
        }
      }
    });
  }

  async dayOf(itineraryId: string, dayIndex: number): Promise<{ id: string } | null> {
    const rows = await this.db
      .select({ id: itineraryDays.id })
      .from(itineraryDays)
      .where(and(eq(itineraryDays.itineraryId, itineraryId), eq(itineraryDays.dayIndex, dayIndex)));
    return rows[0] ?? null;
  }

  async pinnedOfDay(dayId: string): Promise<PinnedItem[]> {
    const rows = await this.db
      .select({
        slot: itineraryItems.slot,
        type: itineraryItems.type,
        title: itineraryItems.title
      })
      .from(itineraryItems)
      .where(and(eq(itineraryItems.dayId, dayId), eq(itineraryItems.pinned, true)));
    return rows.map((row) => ({
      dayIndex: 1,
      slot: row.slot as PinnedItem["slot"],
      type: row.type as PinnedItem["type"],
      title: row.title
    }));
  }

  // Regenera só os itens de um dia: preserva os pinned, troca o resto.
  async replaceDayItems(
    dayId: string,
    slots: BuildItineraryOutput["days"][number]["slots"],
    pinnedKeys: Set<string>
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(itineraryItems).where(eq(itineraryItems.dayId, dayId));
      if (slots.length > 0) {
        await tx.insert(itineraryItems).values(
          slots.map((slot, index) => ({
            id: crypto.randomUUID(),
            dayId,
            slot: slot.slot,
            type: slot.type,
            title: slot.title,
            description: slot.description ?? null,
            durationMin: slot.durationMin ?? null,
            estCost: slot.estCost === undefined ? null : String(slot.estCost),
            sortOrder: index,
            pinned: pinnedKeys.has(`${slot.slot}|${slot.type}|${slot.title}`)
          }))
        );
      }
    });
  }

  // Item do roteiro, restrito à viagem — evita mexer em item de outra trip.
  async itemOfTrip(tripId: string, itemId: string): Promise<ItemRow | null> {
    const rows = await this.db
      .select({ item: itineraryItems })
      .from(itineraryItems)
      .innerJoin(itineraryDays, eq(itineraryItems.dayId, itineraryDays.id))
      .innerJoin(itineraries, eq(itineraryDays.itineraryId, itineraries.id))
      .where(and(eq(itineraryItems.id, itemId), eq(itineraries.tripId, tripId)));
    return rows[0]?.item ?? null;
  }

  // Troca o lugar de um item já existente (swap_restaurant, design §6.4).
  async applyPlaceToItem(
    itemId: string,
    place: { name: string; placeId: string; lat: number; lng: number; rating: number | null }
  ): Promise<ItemRow> {
    const rows = await this.db
      .update(itineraryItems)
      .set({
        title: place.name,
        placeId: place.placeId,
        lat: String(place.lat),
        lng: String(place.lng),
        rating: place.rating === null ? null : String(place.rating),
        needsReview: false
      })
      .where(eq(itineraryItems.id, itemId))
      .returning();
    return rows[0]!;
  }

  async markReady(itineraryId: string): Promise<void> {
    await this.db
      .update(itineraries)
      .set({ status: "ready", error: null, generatedAt: new Date() })
      .where(eq(itineraries.id, itineraryId));
  }

  async markFailed(itineraryId: string, error: string): Promise<void> {
    await this.db
      .update(itineraries)
      .set({ status: "failed", error })
      .where(eq(itineraries.id, itineraryId));
  }
}
