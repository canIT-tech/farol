import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { users } from "./schema";

describe("schema.users", () => {
  it("a tabela se chama users", () => {
    expect(getTableName(users)).toBe("users");
  });

  it("tem as colunas mínimas do design (seção 5.1)", () => {
    const cols = Object.keys(getTableColumns(users));
    expect(cols.sort()).toEqual(["createdAt", "displayName", "email", "id"].sort());
  });

  it("mapeia os nomes de coluna do banco", () => {
    const c = getTableColumns(users);
    expect(c.id.name).toBe("id");
    expect(c.email.name).toBe("email");
    expect(c.displayName.name).toBe("display_name");
    expect(c.createdAt.name).toBe("created_at");
  });

  it("id é a primary key uuid", () => {
    const { id } = getTableColumns(users);
    expect(id.primary).toBe(true);
    expect(id.dataType).toBe("string");
    expect(id.columnType).toBe("PgUUID");
  });

  it("email é notNull e displayName é opcional", () => {
    const c = getTableColumns(users);
    expect(c.email.notNull).toBe(true);
    expect(c.displayName.notNull).toBe(false);
  });

  it("createdAt é notNull, timestamptz e default now()", () => {
    const { createdAt } = getTableColumns(users);
    expect(createdAt.notNull).toBe(true);
    expect(createdAt.hasDefault).toBe(true);
    expect(createdAt.getSQLType()).toBe("timestamp with time zone");
  });
});
