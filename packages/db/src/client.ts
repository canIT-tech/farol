import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDbClient(url: string): {
  db: PostgresJsDatabase<typeof schema>;
  close: () => Promise<void>;
} {
  // Stryker disable next-line all: config de pool/timeout do driver, sem efeito observável em teste unitário
  const sql = postgres(url, { max: 5 });
  return {
    db: drizzle(sql, { schema }),
    // Stryker disable next-line all: timeout de encerramento do pool
    close: () => sql.end({ timeout: 5 })
  };
}
