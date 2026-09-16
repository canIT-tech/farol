import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { trips, users, type Database } from "@farol/db";
import { PaymentRequiredError } from "@farol/shared";
import { DB } from "../db/db.module";

export type UnlockOutcome = "already" | "free" | "credit";

export interface CreditsSummary {
  credits: number;
  freeItineraryUsed: boolean;
}

// Saldo, roteiro grátis e o gate (spec pagamento 2026-09-15 §5). Sem ledger:
// o UPDATE condicional é o lock — duas requisições com saldo 1 disputam a mesma
// linha de users e a segunda revê o WHERE já com o valor decrementado.
@Injectable()
export class CreditsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Destrava o roteiro da viagem: grátis se a conta ainda tem o 1º, senão
  // 1 crédito; viagem já destravada não cobra de novo. Lança 402 sem saldo.
  async unlock(userId: string, tripId: string): Promise<UnlockOutcome> {
    return this.db.transaction(async (tx) => {
      const [trip] = await tx
        .select({ unlockedAt: trips.unlockedAt })
        .from(trips)
        .where(eq(trips.id, tripId));
      if (trip?.unlockedAt) {
        return "already";
      }

      const free = await tx
        .update(users)
        .set({ freeItineraryUsedAt: sql`now()` })
        .where(and(eq(users.id, userId), isNull(users.freeItineraryUsedAt)))
        .returning({ id: users.id });
      if (free.length === 1) {
        await this.markUnlocked(tx, tripId, "free");
        return "free";
      }

      const paid = await tx
        .update(users)
        .set({ credits: sql`${users.credits} - 1` })
        .where(and(eq(users.id, userId), gte(users.credits, 1)))
        .returning({ id: users.id });
      if (paid.length === 0) {
        throw new PaymentRequiredError();
      }
      await this.markUnlocked(tx, tripId, "credit");
      return "credit";
    });
  }

  // Reserva agora, devolve se o job falhar em definitivo: o crédito volta ao
  // saldo ou o grátis volta a valer, e a viagem fica livre para tentar de novo.
  async release(tripId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [trip] = await tx
        .select({ userId: trips.userId, via: trips.unlockedVia })
        .from(trips)
        .where(eq(trips.id, tripId));
      if (!trip || trip.via === null) {
        return;
      }
      if (trip.via === "credit") {
        await tx
          .update(users)
          .set({ credits: sql`${users.credits} + 1` })
          .where(eq(users.id, trip.userId));
      } else {
        await tx.update(users).set({ freeItineraryUsedAt: null }).where(eq(users.id, trip.userId));
      }
      await tx.update(trips).set({ unlockedAt: null, unlockedVia: null }).where(eq(trips.id, tripId));
    });
  }

  async summary(userId: string): Promise<CreditsSummary> {
    const [row] = await this.db
      .select({ credits: users.credits, freeAt: users.freeItineraryUsedAt })
      .from(users)
      .where(eq(users.id, userId));
    return { credits: row?.credits ?? 0, freeItineraryUsed: row?.freeAt != null };
  }

  private async markUnlocked(
    tx: Pick<Database, "update">,
    tripId: string,
    via: "free" | "credit"
  ): Promise<void> {
    await tx
      .update(trips)
      .set({ unlockedAt: sql`now()`, unlockedVia: via })
      .where(eq(trips.id, tripId));
  }
}
