import { describe, it, expect } from "vitest";
import {
  tasteProfileInputSchema,
  tasteProfileSchema,
  paceEnum,
  partyEnum,
  budgetEnum
} from "./taste-profile.js";

const base = {
  interests: ["praia", "gastronomia", "sossego"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {}
};

describe("tasteProfileInputSchema", () => {
  it("aceita um perfil válido", () => {
    const parsed = tasteProfileInputSchema.parse(base);
    expect(parsed.interests).toHaveLength(3);
    expect(parsed.pace).toBe("moderado");
  });

  it("exige ao menos 3 interesses", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, interests: ["praia", "sol"] })).toThrow();
  });

  it("aceita exatamente 3 interesses (limite inferior)", () => {
    expect(tasteProfileInputSchema.parse({ ...base, interests: ["a", "b", "c"] }).interests).toEqual([
      "a",
      "b",
      "c"
    ]);
  });

  it("rejeita interesse vazio (cada item exige min 1 char)", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, interests: ["", "b", "c"] })).toThrow();
  });

  it("rejeita interests que não é array", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, interests: "praia" })).toThrow();
  });

  it("aceita todos os valores de pace do enum", () => {
    for (const pace of ["relaxado", "moderado", "intenso"] as const) {
      expect(tasteProfileInputSchema.parse({ ...base, pace }).pace).toBe(pace);
    }
  });

  it("rejeita pace fora do enum", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, pace: "devagar" })).toThrow();
  });

  it("aceita todos os valores de partyType do enum", () => {
    for (const partyType of ["sozinho", "casal", "familia", "amigos"] as const) {
      expect(tasteProfileInputSchema.parse({ ...base, partyType }).partyType).toBe(partyType);
    }
  });

  it("rejeita partyType fora do enum", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, partyType: "trio" })).toThrow();
  });

  it("aceita todos os valores de budgetBand do enum", () => {
    for (const budgetBand of ["economico", "medio", "conforto", "luxo"] as const) {
      expect(tasteProfileInputSchema.parse({ ...base, budgetBand }).budgetBand).toBe(budgetBand);
    }
  });

  it("rejeita budgetBand fora do enum", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, budgetBand: "mixado" })).toThrow();
  });

  it("usa objeto vazio como default de constraints quando omitido", () => {
    const { constraints } = tasteProfileInputSchema.parse({
      interests: ["a", "b", "c"],
      pace: "relaxado",
      partyType: "sozinho",
      budgetBand: "economico"
    });
    expect(constraints).toEqual({});
  });

  it("aceita cada campo de constraints individualmente", () => {
    expect(tasteProfileInputSchema.parse({ ...base, constraints: { mobility: true } }).constraints).toEqual({
      mobility: true
    });
    expect(tasteProfileInputSchema.parse({ ...base, constraints: { kids: true } }).constraints.kids).toBe(
      true
    );
    expect(tasteProfileInputSchema.parse({ ...base, constraints: { pet: true } }).constraints.pet).toBe(true);
    expect(
      tasteProfileInputSchema.parse({ ...base, constraints: { dietary: ["vegetariano", "sem gluten"] } })
        .constraints.dietary
    ).toEqual(["vegetariano", "sem gluten"]);
  });

  it("aceita constraints com todos os campos preenchidos", () => {
    const constraints = { mobility: true, kids: false, pet: true, dietary: ["vegano"] };
    expect(tasteProfileInputSchema.parse({ ...base, constraints }).constraints).toEqual(constraints);
  });

  it("rejeita tipo errado em campo de constraints", () => {
    expect(() => tasteProfileInputSchema.parse({ ...base, constraints: { kids: "sim" } })).toThrow();
    expect(() => tasteProfileInputSchema.parse({ ...base, constraints: { dietary: "vegano" } })).toThrow();
  });
});

describe("enums exportados", () => {
  it("paceEnum tem exatamente as três opções", () => {
    expect(paceEnum.options).toEqual(["relaxado", "moderado", "intenso"]);
  });

  it("partyEnum tem exatamente as quatro opções", () => {
    expect(partyEnum.options).toEqual(["sozinho", "casal", "familia", "amigos"]);
  });

  it("budgetEnum tem exatamente as quatro opções", () => {
    expect(budgetEnum.options).toEqual(["economico", "medio", "conforto", "luxo"]);
  });
});

describe("tasteProfileSchema", () => {
  const full = {
    ...base,
    id: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    updatedAt: "2026-08-29T12:00:00.000Z"
  };

  it("aceita um perfil completo com id, userId e updatedAt", () => {
    const parsed = tasteProfileSchema.parse(full);
    expect(parsed.id).toBe(full.id);
    expect(parsed.userId).toBe(full.userId);
    expect(parsed.updatedAt).toBe(full.updatedAt);
  });

  it("exige id em formato uuid", () => {
    expect(() => tasteProfileSchema.parse({ ...full, id: "abc" })).toThrow();
  });

  it("exige userId em formato uuid", () => {
    expect(() => tasteProfileSchema.parse({ ...full, userId: "abc" })).toThrow();
  });

  it("exige updatedAt", () => {
    const semData = { ...full } as Record<string, unknown>;
    delete semData.updatedAt;
    expect(() => tasteProfileSchema.parse(semData)).toThrow();
  });

  it("herda as regras do input (mín. 3 interesses)", () => {
    expect(() => tasteProfileSchema.parse({ ...full, interests: ["praia"] })).toThrow();
  });
});
