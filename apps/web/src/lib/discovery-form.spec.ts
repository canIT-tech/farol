import { describe, it, expect } from "vitest";
import {
  EMPTY_DISCOVERY_FORM,
  canSubmitDiscovery,
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
