import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { trips, tripDestinations, type Database } from "@farol/db";
import { ForbiddenError, NotFoundError, type TripInput } from "@farol/shared";
import { DB } from "../db/db.module";
import { buildTripState, toTrip, type Trip, type TripState } from "./trip-state";

@Injectable()
export class TripsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async create(userId: string, input: TripInput): Promise<Trip> {
    const rows = await this.db
      .insert(trips)
      .values({
        id: crypto.randomUUID(),
        userId,
        status: "draft",
        title: input.title ?? null,
        originIata: input.originIata,
        dateStart: input.dateStart ?? null,
        dateEnd: input.dateEnd ?? null,
        durationDays: input.durationDays ?? null,
        targetMonth: input.targetMonth ?? null,
        party: input.party,
        budgetTotal: String(input.budgetTotal),
        currency: input.currency
      })
      .returning();
    return toTrip(rows[0]!);
  }

  async list(userId: string): Promise<Trip[]> {
    const rows = await this.db
      .select()
      .from(trips)
      .where(eq(trips.userId, userId))
      .orderBy(desc(trips.createdAt));
    return rows.map(toTrip);
  }

  async get(userId: string, tripId: string): Promise<TripState> {
    const rows = await this.db.select().from(trips).where(eq(trips.id, tripId));
    const tripRow = rows[0];
    if (!tripRow) {
      throw new NotFoundError("viagem não encontrada");
    }
    if (tripRow.userId !== userId) {
      throw new ForbiddenError("essa viagem pertence a outro usuário");
    }
    const destinationRows = await this.db
      .select()
      .from(tripDestinations)
      .where(eq(tripDestinations.tripId, tripId));
    return buildTripState(tripRow, destinationRows);
  }
}
