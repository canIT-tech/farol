import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { users, tasteProfiles } from "./schema";

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

describe("schema.tasteProfiles", () => {
  it("tem as colunas do design §5.2", () => {
    const cols = Object.keys(getTableColumns(tasteProfiles)).sort();
    expect(cols).toEqual(
      ["budgetBand", "constraints", "id", "interests", "pace", "partyType", "updatedAt", "userId"].sort()
    );
  });

  it("a tabela se chama taste_profiles com nomes de coluna snake_case", () => {
    expect(getTableName(tasteProfiles)).toBe("taste_profiles");
    const c = getTableColumns(tasteProfiles);
    expect(c.userId.name).toBe("user_id");
    expect(c.partyType.name).toBe("party_type");
    expect(c.budgetBand.name).toBe("budget_band");
    expect(c.updatedAt.name).toBe("updated_at");
  });

  it("userId é notNull e unique", () => {
    const { userId } = getTableColumns(tasteProfiles);
    expect(userId.notNull).toBe(true);
    expect(userId.isUnique).toBe(true);
  });

  it("interests e constraints são jsonb notNull com default", () => {
    const c = getTableColumns(tasteProfiles);
    expect(c.interests.notNull).toBe(true);
    expect(c.interests.hasDefault).toBe(true);
    expect(c.constraints.notNull).toBe(true);
    expect(c.constraints.hasDefault).toBe(true);
  });

  it("pace, partyType e budgetBand são text notNull", () => {
    const c = getTableColumns(tasteProfiles);
    for (const k of ["pace", "partyType", "budgetBand"] as const) {
      expect(c[k].notNull).toBe(true);
      expect(c[k].columnType).toBe("PgText");
    }
  });

  it("updatedAt é timestamptz notNull com default", () => {
    const { updatedAt } = getTableColumns(tasteProfiles);
    expect(updatedAt.notNull).toBe(true);
    expect(updatedAt.hasDefault).toBe(true);
    expect(updatedAt.getSQLType()).toBe("timestamp with time zone");
  });
});

describe("taste_profiles FK", () => {
  it("referencia users.id com ON DELETE cascade", () => {
    const fks = getTableConfig(tasteProfiles).foreignKeys;
    expect(fks).toHaveLength(1);
    const ref = fks[0]!.reference();
    expect(ref.foreignTable).toBe(users);
    expect(ref.foreignColumns[0]!.name).toBe("id");
    expect(fks[0]!.onDelete).toBe("cascade");
  });
});
