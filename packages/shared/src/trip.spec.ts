import { describe, it, expect } from "vitest";
import {
  tripInputSchema,
  tripStatusEnum,
  tripPartySchema,
  isoDateSchema,
  yearMonthSchema
} from "./trip";

const withDates = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 12000,
  dateStart: "2026-09-10",
  dateEnd: "2026-09-17"
};
const withDuration = {
  originIata: "GRU",
  party: { adults: 1, children: 0 },
  budgetTotal: 8000,
  durationDays: 7,
  targetMonth: "2026-09"
};

describe("isoDateSchema", () => {
  it("aceita YYYY-MM-DD", () => {
    expect(isoDateSchema.parse("2026-09-10")).toBe("2026-09-10");
  });

  it.each([
    "2026-9-10",
    "2026-09-1",
    "202-09-10",
    "20260-09-10",
    "2026/09/10",
    " 2026-09-10",
    "2026-09-10 ",
    "x2026-09-10",
    "2026-09-10x",
    "2026-09-10T00:00"
  ])("rejeita %s", (bad) => {
    expect(isoDateSchema.safeParse(bad).success).toBe(false);
  });

  it("mensagem de erro menciona o formato YYYY-MM-DD", () => {
    const res = isoDateSchema.safeParse("nope");
    expect(res.success).toBe(false);
    expect(res.error!.issues[0]!.message).toBe("data no formato YYYY-MM-DD");
  });
});

describe("yearMonthSchema", () => {
  it("aceita YYYY-MM", () => {
    expect(yearMonthSchema.parse("2026-09")).toBe("2026-09");
  });

  it.each(["2026-9", "26-09", "2026/09", "2026-09-01", "x2026-09", "2026-09x"])(
    "rejeita %s",
    (bad) => {
      expect(yearMonthSchema.safeParse(bad).success).toBe(false);
    }
  );

  it("mensagem de erro menciona o formato YYYY-MM", () => {
    const res = yearMonthSchema.safeParse("nope");
    expect(res.error!.issues[0]!.message).toBe("mês no formato YYYY-MM");
  });
});

describe("tripStatusEnum", () => {
  it("tem draft, planned, done", () => {
    expect(tripStatusEnum.options).toEqual(["draft", "planned", "done"]);
  });
});

describe("tripPartySchema", () => {
  it("exige ao menos 1 adulto e children >= 0", () => {
    expect(() => tripPartySchema.parse({ adults: 0, children: 0 })).toThrow();
    expect(() => tripPartySchema.parse({ adults: 1, children: -1 })).toThrow();
    expect(tripPartySchema.parse({ adults: 1, children: 0 })).toEqual({ adults: 1, children: 0 });
  });

  it("rejeita adults fracionário", () => {
    expect(() => tripPartySchema.parse({ adults: 1.5, children: 0 })).toThrow();
  });
});

describe("tripInputSchema", () => {
  it("aceita datas exatas e aplica currency default BRL", () => {
    const parsed = tripInputSchema.parse(withDates);
    expect(parsed.currency).toBe("BRL");
    expect(parsed.dateStart).toBe("2026-09-10");
  });

  it("aceita duração + mês alvo", () => {
    const parsed = tripInputSchema.parse(withDuration);
    expect(parsed.durationDays).toBe(7);
    expect(parsed.targetMonth).toBe("2026-09");
  });

  it("respeita currency informado", () => {
    expect(tripInputSchema.parse({ ...withDates, currency: "USD" }).currency).toBe("USD");
  });

  it("rejeita datas e duração juntas", () => {
    expect(() =>
      tripInputSchema.parse({ ...withDates, durationDays: 7, targetMonth: "2026-09" })
    ).toThrow(/exatamente um/);
  });

  it("rejeita quando não vem nem datas nem duração", () => {
    expect(() =>
      tripInputSchema.parse({ originIata: "GRU", party: { adults: 1, children: 0 }, budgetTotal: 5000 })
    ).toThrow(/exatamente um/);
  });

  it.each([
    ["só dateStart", { dateStart: "2026-09-10" }],
    ["só dateEnd", { dateEnd: "2026-09-17" }],
    ["só durationDays", { durationDays: 7 }],
    ["só targetMonth", { targetMonth: "2026-09" }],
    ["dateStart + durationDays", { dateStart: "2026-09-10", durationDays: 7 }],
    ["dateEnd + targetMonth", { dateEnd: "2026-09-17", targetMonth: "2026-09" }],
    ["dateStart + targetMonth", { dateStart: "2026-09-10", targetMonth: "2026-09" }]
  ])("rejeita combinação incompleta/ambígua: %s", (_label, extra) => {
    expect(() =>
      tripInputSchema.parse({
        originIata: "GRU",
        party: { adults: 1, children: 0 },
        budgetTotal: 5000,
        ...extra
      })
    ).toThrow(/exatamente um/);
  });

  it("rejeita dateEnd anterior ou igual a dateStart, apontando o campo dateEnd", () => {
    expect(() => tripInputSchema.parse({ ...withDates, dateEnd: "2026-09-01" })).toThrow(/posterior/);
    const res = tripInputSchema.safeParse({ ...withDates, dateEnd: "2026-09-10" });
    expect(res.success).toBe(false);
    expect(res.error!.issues[0]!.path).toEqual(["dateEnd"]);
    expect(res.error!.issues[0]!.message).toBe("dateEnd deve ser posterior a dateStart");
  });

  it("aceita dateEnd um dia após dateStart (limite)", () => {
    expect(
      tripInputSchema.parse({ ...withDates, dateStart: "2026-09-10", dateEnd: "2026-09-11" }).dateEnd
    ).toBe("2026-09-11");
  });

  it("rejeita originIata que não tem 3 letras", () => {
    expect(() => tripInputSchema.parse({ ...withDates, originIata: "GR" })).toThrow();
    expect(() => tripInputSchema.parse({ ...withDates, originIata: "GRUU" })).toThrow();
  });

  it("rejeita budgetTotal <= 0", () => {
    expect(() => tripInputSchema.parse({ ...withDates, budgetTotal: 0 })).toThrow();
    expect(() => tripInputSchema.parse({ ...withDates, budgetTotal: -1 })).toThrow();
  });

  it("rejeita durationDays fora de 2..30", () => {
    expect(() => tripInputSchema.parse({ ...withDuration, durationDays: 1 })).toThrow();
    expect(() => tripInputSchema.parse({ ...withDuration, durationDays: 31 })).toThrow();
  });

  it("aceita os limites de durationDays (2 e 30)", () => {
    expect(tripInputSchema.parse({ ...withDuration, durationDays: 2 }).durationDays).toBe(2);
    expect(tripInputSchema.parse({ ...withDuration, durationDays: 30 }).durationDays).toBe(30);
  });

  it("rejeita targetMonth em formato errado", () => {
    expect(() => tripInputSchema.parse({ ...withDuration, targetMonth: "2026/09" })).toThrow();
    expect(() => tripInputSchema.parse({ ...withDuration, targetMonth: "26-09" })).toThrow();
  });

  it("rejeita dateStart em formato errado", () => {
    expect(() => tripInputSchema.parse({ ...withDates, dateStart: "10-09-2026" })).toThrow();
  });

  it("aceita title opcional", () => {
    expect(tripInputSchema.parse({ ...withDates, title: "Setembro no Nordeste" }).title).toBe(
      "Setembro no Nordeste"
    );
  });
});
