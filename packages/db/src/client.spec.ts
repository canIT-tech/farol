import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { createDbClient } from "./client.js";
import { runMigrations } from "./migrate.js";
import { users, tasteProfiles } from "./schema.js";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/db");

const { db, close } = createDbClient(url);
afterAll(() => close());

// Zera o schema uma vez para que runMigrations faça trabalho de verdade
// (mata o mutante de "corpo vazio" mesmo com o banco compartilhado do Stryker).
//
// Schema inteiro, não duas tabelas: dropar só `users` deixava as outras 11 com
// linhas órfãs, e aí o runMigrations falhava ao re-adicionar a FK de `trips`.
// Só é seguro porque DATABASE_URL_TEST aponta para um banco separado do de
// desenvolvimento.
beforeAll(async () => {
  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);
  await db.execute(sql`drop schema if exists drizzle cascade`);
  await runMigrations(url);
});

describe("createDbClient + runMigrations", () => {
  it("aplica as migrations e as tabelas existem", async () => {
    const rows = await db.execute(
      sql`select table_name from information_schema.tables where table_name in ('users', 'taste_profiles')`
    );
    expect(rows.length).toBe(2);
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

  it("runMigrations é idempotente (roda de novo sem erro)", async () => {
    await expect(runMigrations(url)).resolves.toBeUndefined();
  });
});

describe("taste_profiles", () => {
  it("insere um perfil ligado a um usuário e lê de volta", async () => {
    const uid = crypto.randomUUID();
    await db.insert(users).values({ id: uid, email: `tp_${uid}@farol.test` });
    const pid = crypto.randomUUID();
    await db.insert(tasteProfiles).values({
      id: pid,
      userId: uid,
      pace: "moderado",
      partyType: "casal",
      budgetBand: "medio"
    });
    const rows = await db.select().from(tasteProfiles).where(sql`${tasteProfiles.id} = ${pid}`);
    expect(rows[0]?.userId).toBe(uid);
    expect(rows[0]?.interests).toEqual([]);
    expect(rows[0]?.constraints).toEqual({});
  });

  it("apaga em cascata quando o usuário é removido", async () => {
    const uid = crypto.randomUUID();
    await db.insert(users).values({ id: uid, email: `c_${uid}@farol.test` });
    await db.insert(tasteProfiles).values({
      id: crypto.randomUUID(),
      userId: uid,
      pace: "relaxado",
      partyType: "sozinho",
      budgetBand: "economico"
    });
    await db.delete(users).where(sql`${users.id} = ${uid}`);
    const rows = await db.select().from(tasteProfiles).where(sql`${tasteProfiles.userId} = ${uid}`);
    expect(rows).toHaveLength(0);
  });
});
