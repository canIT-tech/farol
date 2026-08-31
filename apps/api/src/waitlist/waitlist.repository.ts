import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { waitlist, type Database } from "@farol/db";
import { DB } from "../db/db.module";

@Injectable()
export class WaitlistRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // Insere o e-mail; devolve true se criou a linha, false se o e-mail já existia.
  async add(email: string, source: string | null): Promise<boolean> {
    const rows = await this.db
      .insert(waitlist)
      .values({ id: crypto.randomUUID(), email, source })
      .onConflictDoNothing({ target: waitlist.email })
      .returning({ id: waitlist.id });
    return rows.length > 0;
  }

  async count(): Promise<number> {
    const rows = await this.db.select({ c: sql<string>`count(*)` }).from(waitlist);
    return Number(rows[0]!.c);
  }
}
