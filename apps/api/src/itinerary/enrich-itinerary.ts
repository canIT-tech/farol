import { eq, inArray } from "drizzle-orm";
import { itineraryDays, itineraryItems, type Database } from "@farol/db";
import type { Place } from "@farol/shared";
import type { PlacesService } from "../places/places.service";

export interface EnrichDeps {
  db: Database;
  places: PlacesService;
}

// Só atividade e refeição viram lugar no mapa; transfer/free não têm endereço.
const ENRICHABLE_TYPES = new Set(["activity", "meal"]);
// Slots onde cabe um almoço/jantar (design §6.3 passo b).
const MEAL_SLOTS = ["afternoon", "evening"] as const;
// Faixa de preço do restaurante sugerido: nem barraca, nem estrelado.
const MEAL_MIN_PRICE = 1;
const MEAL_MAX_PRICE = 3;

type ItemRow = typeof itineraryItems.$inferSelect;

function coordsOf(item: ItemRow): { lat: number; lng: number } | null {
  return item.lat === null || item.lng === null
    ? null
    : { lat: Number(item.lat), lng: Number(item.lng) };
}

function centroidOf(items: ItemRow[]): { lat: number; lng: number } | null {
  const coords = items.map(coordsOf).filter((c) => c !== null);
  if (coords.length === 0) {
    return null;
  }
  const sum = coords.reduce(
    (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: sum.lat / coords.length, lng: sum.lng / coords.length };
}

// PlacesService.findFirst já degrada para null, mas o enrich não pode derrubar a
// geração do roteiro por causa de uma busca (design §7.3): qualquer falha vira
// "não achei" e o item fica needsReview.
async function tryFind(
  places: PlacesService,
  ...args: Parameters<PlacesService["findFirst"]>
): Promise<Place | null> {
  try {
    return await places.findFirst(...args);
  } catch {
    return null;
  }
}

function placeColumns(place: Place) {
  return {
    placeId: place.placeId,
    lat: String(place.lat),
    lng: String(place.lng),
    rating: place.rating === null ? null : String(place.rating)
  };
}

// Passo de enrich do roteiro (design §6.3 passo b).
// Idempotente: item que já tem placeId é pulado, dia que já tem refeição não
// ganha outra. Item sem match fica needsReview e é retentado na próxima rodada
// (é assim que o job places.enrich reprocessa, sem precisar de outro filtro).
export async function enrichItinerary(
  deps: EnrichDeps,
  itineraryId: string,
  cityQueryHint: string
): Promise<void> {
  const { db, places } = deps;

  const days = await db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.itineraryId, itineraryId))
    .orderBy(itineraryDays.dayIndex);
  if (days.length === 0) {
    return;
  }

  const items = await db
    .select()
    .from(itineraryItems)
    .where(
      inArray(
        itineraryItems.dayId,
        days.map((day) => day.id)
      )
    )
    .orderBy(itineraryItems.sortOrder);

  // 1) Cada atividade/refeição sem lugar vira uma busca textual.
  for (const item of items) {
    if (!ENRICHABLE_TYPES.has(item.type) || item.placeId !== null) {
      continue;
    }
    const place = await tryFind(places, `${item.title} ${cityQueryHint}`);
    if (place === null) {
      await db
        .update(itineraryItems)
        .set({ needsReview: true })
        .where(eq(itineraryItems.id, item.id));
      continue;
    }
    const columns = placeColumns(place);
    await db
      .update(itineraryItems)
      .set({ ...columns, needsReview: false })
      .where(eq(itineraryItems.id, item.id));
    // Mantém a cópia em memória em dia: o centroide do passo 2 usa estas coordenadas.
    Object.assign(item, columns, { needsReview: false });
  }

  // 2) Dia sem almoço/jantar ganha um restaurante perto do centro do dia.
  for (const day of days) {
    const dayItems = items.filter((item) => item.dayId === day.id);
    const hasMeal = dayItems.some(
      (item) => item.type === "meal" && MEAL_SLOTS.includes(item.slot as (typeof MEAL_SLOTS)[number])
    );
    if (hasMeal) {
      continue;
    }
    const centroid = centroidOf(dayItems);
    if (centroid === null) {
      continue;
    }
    const place = await tryFind(places, "restaurante", {
      near: centroid,
      type: "restaurant",
      minPrice: MEAL_MIN_PRICE,
      maxPrice: MEAL_MAX_PRICE
    });
    if (place === null) {
      continue;
    }
    const taken = new Set(dayItems.map((item) => item.slot));
    const slot = MEAL_SLOTS.find((candidate) => !taken.has(candidate)) ?? "evening";
    const sortOrder = Math.max(...dayItems.map((item) => item.sortOrder)) + 1;
    await db.insert(itineraryItems).values({
      id: crypto.randomUUID(),
      dayId: day.id,
      slot,
      type: "meal",
      title: place.name,
      ...placeColumns(place),
      sortOrder,
      needsReview: false
    });
  }
}
