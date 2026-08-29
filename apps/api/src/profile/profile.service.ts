import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { tasteProfiles, type Database } from "@farol/db";
import {
  NotFoundError,
  tasteProfileSchema,
  type TasteProfile,
  type TasteProfileInput
} from "@farol/shared";
import { DB } from "../db/db.module";

type Row = typeof tasteProfiles.$inferSelect;

function toDto(row: Row): TasteProfile {
  return tasteProfileSchema.parse({
    id: row.id,
    userId: row.userId,
    interests: row.interests,
    pace: row.pace,
    partyType: row.partyType,
    budgetBand: row.budgetBand,
    constraints: row.constraints,
    updatedAt: row.updatedAt.toISOString()
  });
}

@Injectable()
export class ProfileService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async get(userId: string): Promise<TasteProfile> {
    const rows = await this.db.select().from(tasteProfiles).where(eq(tasteProfiles.userId, userId));
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("perfil de gosto não encontrado");
    }
    return toDto(row);
  }

  async upsert(userId: string, input: TasteProfileInput): Promise<TasteProfile> {
    const values = {
      interests: input.interests,
      pace: input.pace,
      partyType: input.partyType,
      budgetBand: input.budgetBand,
      constraints: input.constraints,
      updatedAt: new Date()
    };
    const rows = await this.db
      .insert(tasteProfiles)
      .values({ id: crypto.randomUUID(), userId, ...values })
      .onConflictDoUpdate({ target: tasteProfiles.userId, set: values })
      .returning();
    return toDto(rows[0] as Row);
  }
}
