import { describe, it, expect, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, users, tasteProfiles } from "@farol/db";
import { isDomainError, type TasteProfileInput } from "@farol/shared";
import { ProfileService } from "./profile.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const service = new ProfileService(db);
const userIds: string[] = [];

async function makeUser(): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  return id;
}

const input: TasteProfileInput = {
  interests: ["praia", "gastronomia", "sossego"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: { kids: true }
};

afterEach(async () => {
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds));
    userIds.length = 0;
  }
});
afterAll(() => close());

describe("ProfileService", () => {
  it("upsert cria o perfil e devolve o DTO", async () => {
    const userId = await makeUser();
    const dto = await service.upsert(userId, input);
    expect(dto.userId).toBe(userId);
    expect(dto.interests).toEqual(input.interests);
    expect(dto.pace).toBe("moderado");
    expect(dto.constraints).toEqual({ kids: true });
    expect(typeof dto.updatedAt).toBe("string");

    const rows = await db.select().from(tasteProfiles).where(eq(tasteProfiles.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it("upsert de novo atualiza a mesma linha e avança updatedAt", async () => {
    const userId = await makeUser();
    const first = await service.upsert(userId, input);
    await new Promise((r) => setTimeout(r, 5));
    const second = await service.upsert(userId, { ...input, pace: "intenso", interests: ["a", "b", "c"] });

    expect(second.id).toBe(first.id);
    expect(second.pace).toBe("intenso");
    expect(second.interests).toEqual(["a", "b", "c"]);
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(first.updatedAt).getTime());

    const rows = await db.select().from(tasteProfiles).where(eq(tasteProfiles.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it("get devolve o perfil salvo", async () => {
    const userId = await makeUser();
    await service.upsert(userId, input);
    const dto = await service.get(userId);
    expect(dto.userId).toBe(userId);
    expect(dto.budgetBand).toBe("medio");
  });

  it("get lança NotFoundError quando não há perfil", async () => {
    const userId = await makeUser();
    try {
      await service.get(userId);
      expect.unreachable("deveria ter lançado");
    } catch (err) {
      expect(isDomainError(err)).toBe(true);
      expect((err as { code: string }).code).toBe("not_found");
      expect((err as Error).message).toBe("perfil de gosto não encontrado");
    }
  });
});
