import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { sql, inArray } from "drizzle-orm";
import { createDbClient, users } from "@farol/db";
import { UserUpsertService } from "./user-upsert.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const service = new UserUpsertService(db);
const ids: string[] = [];

function freshId(): string {
  const id = crypto.randomUUID();
  ids.push(id);
  return id;
}

afterEach(async () => {
  if (ids.length > 0) {
    await db.delete(users).where(inArray(users.id, ids));
    ids.length = 0;
  }
});
afterAll(() => close());

describe("UserUpsertService.ensure", () => {
  it("cria a linha em users no primeiro acesso", async () => {
    const id = freshId();
    await service.ensure({ id, email: "novo@farol.test" });
    const rows = await db.select().from(users).where(sql`${users.id} = ${id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("novo@farol.test");
  });

  it("atualiza o e-mail no acesso seguinte sem duplicar a linha", async () => {
    const id = freshId();
    await service.ensure({ id, email: "antigo@farol.test" });
    await service.ensure({ id, email: "atualizado@farol.test" });
    const rows = await db.select().from(users).where(sql`${users.id} = ${id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("atualizado@farol.test");
  });
});

beforeAll(async () => {
  // garante que a tabela existe mesmo se este spec rodar isolado
  await db.execute(sql`select 1 from users limit 1`);
});
