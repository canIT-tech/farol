import { describe, it, expect } from "vitest";
import {
  EMPTY_DISCOVERY_FORM,
  canSubmitDiscovery,
  defaultAdults,
  draftSummary,
  toTripInput,
  type DiscoveryFormState
} from "./discovery-form";

const porMes: DiscoveryFormState = {
  ...EMPTY_DISCOVERY_FORM,
  originIata: "gru",
  targetMonth: "2026-09"
};

const porDatas: DiscoveryFormState = {
  ...EMPTY_DISCOVERY_FORM,
  originIata: "GRU",
  mode: "exact",
  dateStart: "2026-09-10",
  dateEnd: "2026-09-17"
};

describe("toTripInput", () => {
  it("no modo mês manda targetMonth e durationDays", () => {
    const input = toTripInput(porMes)!;
    expect(input.targetMonth).toBe("2026-09");
    expect(input.durationDays).toBe(7);
    expect(input.dateStart).toBeUndefined();
  });

  it("no modo datas manda dateStart e dateEnd", () => {
    const input = toTripInput(porDatas)!;
    expect(input.dateStart).toBe("2026-09-10");
    expect(input.targetMonth).toBeUndefined();
  });

  it("normaliza a origem para maiúsculas e sem espaço", () => {
    expect(toTripInput({ ...porMes, originIata: " gru " })!.originIata).toBe("GRU");
  });

  it("leva viajantes e orçamento", () => {
    const input = toTripInput({ ...porMes, adults: 1, children: 2, budgetTotal: 8000 })!;
    expect(input.party).toEqual({ adults: 1, children: 2 });
    expect(input.budgetTotal).toBe(8000);
  });

  it("devolve null sem origem", () => {
    expect(toTripInput({ ...porMes, originIata: "" })).toBeNull();
  });

  it("devolve null com origem de tamanho errado", () => {
    expect(toTripInput({ ...porMes, originIata: "GR" })).toBeNull();
  });

  it("devolve null no modo mês sem o mês", () => {
    expect(toTripInput({ ...porMes, targetMonth: "" })).toBeNull();
  });

  it("devolve null no modo datas com fim antes do início", () => {
    expect(toTripInput({ ...porDatas, dateEnd: "2026-09-01" })).toBeNull();
  });

  it("devolve null com orçamento zerado", () => {
    expect(toTripInput({ ...porMes, budgetTotal: 0 })).toBeNull();
  });
});

describe("canSubmitDiscovery", () => {
  it("libera quando o input é válido", () => {
    expect(canSubmitDiscovery(porMes)).toBe(true);
  });

  it("bloqueia o formulário vazio", () => {
    expect(canSubmitDiscovery(EMPTY_DISCOVERY_FORM)).toBe(false);
  });
});

describe("draftSummary", () => {
  it("origem em branco fica a definir", () => {
    expect(draftSummary(EMPTY_DISCOVERY_FORM).originIata).toBeNull();
  });

  it("normaliza a origem para maiúsculas", () => {
    expect(draftSummary({ ...EMPTY_DISCOVERY_FORM, originIata: "gru" }).originIata).toBe("GRU");
  });

  it("no modo mês leva o mês e a duração, e nenhuma data", () => {
    const out = draftSummary({ ...EMPTY_DISCOVERY_FORM, targetMonth: "2026-09", dateStart: "2026-05-10" });
    expect(out.targetMonth).toBe("2026-09");
    expect(out.durationDays).toBe(7);
    expect(out.dateStart).toBeNull();
    expect(out.dateEnd).toBeNull();
  });

  it("no modo datas leva as datas, e nenhum mês", () => {
    const out = draftSummary({
      ...EMPTY_DISCOVERY_FORM,
      mode: "exact",
      dateStart: "2026-05-10",
      dateEnd: "2026-05-17",
      targetMonth: "2026-09"
    });
    expect(out.dateStart).toBe("2026-05-10");
    expect(out.dateEnd).toBe("2026-05-17");
    expect(out.targetMonth).toBeNull();
    expect(out.durationDays).toBeNull();
  });

  it("leva viajantes e orçamento, e nunca um destino", () => {
    const out = draftSummary({ ...EMPTY_DISCOVERY_FORM, adults: 3, children: 1, budgetTotal: 9000 });
    expect(out.party).toEqual({ adults: 3, children: 1 });
    expect(out.budgetTotal).toBe(9000);
    expect(out.currency).toBe("BRL");
    expect(out.chosenDestination).toBeNull();
  });
});

describe("defaultAdults", () => {
  it("quem viaja sozinho começa com 1 adulto", () => {
    expect(defaultAdults("sozinho")).toBe(1);
  });

  it("casal, família e amigos ficam no padrão", () => {
    expect(defaultAdults("casal")).toBe(2);
    expect(defaultAdults("familia")).toBe(2);
    expect(defaultAdults("amigos")).toBe(2);
  });

  it("sem perfil, fica no padrão", () => {
    expect(defaultAdults(null)).toBe(2);
  });
});
