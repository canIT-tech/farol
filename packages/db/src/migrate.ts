import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";

export async function runMigrations(url: string): Promise<void> {
  // Stryker disable next-line all: config de conexão de uso único para a migração
  const sql = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(sql), {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url))
    });
  } finally {
    // Stryker disable next-line all: timeout de encerramento
    await sql.end({ timeout: 5 });
  }
}
