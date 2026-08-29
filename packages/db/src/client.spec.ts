import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { createDbClient } from "./client";
import { runMigrations } from "./migrate";
import { users } from "./schema";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/db");

const { db, close } = createDbClient(url);
afterAll(() => close());

// Zera o schema para que runMigrations tenha que fazer trabalho de verdade
// (mata o mutante de "corpo vazio" mesmo com o banco compartilhado do Stryker).
beforeAll(async () => {
  await db.execute(sql`drop table if exists "users" cascade`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
});

describe("createDbClient + runMigrations", () => {
  it("aplica as migrations e a tabela users existe", async () => {
    await db.execute(sql`select 1 from information_schema.tables where table_name = 'users'`).then(
      (r) => expect(r.length).toBe(0) // antes da migração, não existe
    );
    await runMigrations(url);
    const rows = await db.execute(
      sql`select 1 from information_schema.tables where table_name = 'users'`
    );
    expect(rows.length).toBe(1);
  });

  it("faz insert e select de um usuário", async () => {
    const id = crypto.randomUUID();
    await db.insert(users).values({ id, email: `u_${id}@farol.test` });
    const found = await db.select().from(users).where(sql`${users.id} = ${id}`);
    expect(found[0]?.email).toBe(`u_${id}@farol.test`);
  });

  it("created_at é timestamptz com default", async () => {
    const rows = await db.execute(sql`
      select data_type, column_default
      from information_schema.columns
      where table_name = 'users' and column_name = 'created_at'
    `);
    const row = rows[0] as { data_type: string; column_default: string | null };
    expect(row.data_type).toBe("timestamp with time zone");
    expect(row.column_default).toMatch(/now\(\)/);
  });

  it("insert sem id falha (id é obrigatório)", async () => {
    await expect(db.insert(users).values({ email: "x@farol.test" } as never)).rejects.toThrow();
  });

  it("close encerra o pool — query após close falha", async () => {
    const throwaway = createDbClient(url);
    await throwaway.close();
    await expect(throwaway.db.execute(sql`select 1`)).rejects.toThrow();
  });

  it("expõe a query API com o schema registrado", async () => {
    const rows = await db.query.users.findMany({ limit: 1 });
    expect(Array.isArray(rows)).toBe(true);
  });
});
