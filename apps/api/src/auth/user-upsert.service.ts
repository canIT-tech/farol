import { Inject, Injectable } from "@nestjs/common";
import { users, type Database } from "@farol/db";
import type { CurrentUser } from "@farol/shared";
import { DB } from "../db/db.module";

// Único estado de auth da api: garante uma linha em users no primeiro acesso
// e mantém o e-mail em dia nos acessos seguintes.
@Injectable()
export class UserUpsertService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async ensure(user: CurrentUser): Promise<void> {
    await this.db
      .insert(users)
      .values({ id: user.id, email: user.email })
      .onConflictDoUpdate({ target: users.id, set: { email: user.email } });
  }
}
