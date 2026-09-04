import { describe, it, expect } from "vitest";
import {
  addMonths,
  currentMonth,
  daysInMonth,
  firstWeekday,
  formatRange,
  isBefore,
  isInside,
  isPastMonth,
  monthLabel,
  monthMatrix,
  monthOf,
  nextRange,
  todayIso,
  parseIso,
  parseMonthKey,
  toMonthKey,
  toIso
} from "./calendar";

describe("toIso / parseIso", () => {
  it("preenche mês e dia com zero à esquerda", () => {
    expect(toIso({ year: 2026, month: 5 }, 7)).toBe("2026-05-07");
  });

  it("volta para números", () => {
    expect(parseIso("2026-05-07")).toEqual({ year: 2026, month: 5, day: 7 });
  });
});

describe("daysInMonth", () => {
  it("conta 31 em maio", () => {
    expect(daysInMonth({ year: 2026, month: 5 })).toBe(31);
  });

  it("conta 30 em abril", () => {
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
  });

  it("conta 28 em fevereiro comum e 29 em bissexto", () => {
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
  });
});

describe("firstWeekday", () => {
  it("1º de maio de 2026 é sexta", () => {
    expect(firstWeekday({ year: 2026, month: 5 })).toBe(5);
  });

  it("1º de novembro de 2026 é domingo", () => {
    expect(firstWeekday({ year: 2026, month: 11 })).toBe(0);
  });
});

describe("addMonths", () => {
  it("anda para frente dentro do ano", () => {
    expect(addMonths({ year: 2026, month: 5 }, 2)).toEqual({ year: 2026, month: 7 });
  });

  it("vira o ano para frente", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("vira o ano para trás", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("anda mais de um ano de uma vez", () => {
    expect(addMonths({ year: 2026, month: 3 }, -14)).toEqual({ year: 2025, month: 1 });
  });
});

describe("monthMatrix", () => {
  const maio = monthMatrix({ year: 2026, month: 5 });

  it("entrega semanas completas de 7 casas", () => {
    expect(maio.every((week) => week.length === 7)).toBe(true);
  });

  it("deixa vazias as casas antes do dia 1", () => {
    expect(maio[0]!.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(maio[0]![5]).toBe("2026-05-01");
  });

  it("fecha a última semana com vazios", () => {
    // 1º de maio cai na sexta (offset 5), então o dia 31 abre a última semana.
    const ultima = maio.at(-1)!;
    expect(ultima[0]).toBe("2026-05-31");
    expect(ultima[1]).toBeNull();
  });

  it("cobre todos os dias do mês", () => {
    expect(maio.flat().filter((d) => d !== null)).toHaveLength(31);
  });

  it("não abre semana extra quando o mês fecha exato", () => {
    // Fevereiro de 2026 começa no domingo e tem 28 dias: 4 semanas cheias.
    expect(monthMatrix({ year: 2026, month: 2 })).toHaveLength(4);
  });
});

describe("monthLabel / monthOf", () => {
  it("escreve o mês por extenso", () => {
    expect(monthLabel({ year: 2026, month: 5 })).toBe("maio de 2026");
  });

  it("tira ano e mês de uma data", () => {
    expect(monthOf("2026-05-10")).toEqual({ year: 2026, month: 5 });
  });
});

describe("formatRange", () => {
  it("vazio sem início", () => {
    expect(formatRange("", "")).toBe("");
  });

  it("mostra só a ida enquanto não há volta", () => {
    expect(formatRange("2026-05-10", "")).toBe("10 mai 2026");
  });

  it("omite o mês repetido dentro do mesmo mês", () => {
    expect(formatRange("2026-05-10", "2026-05-17")).toBe("10 – 17 mai 2026");
  });

  it("mostra os dois meses quando o intervalo vira o mês", () => {
    expect(formatRange("2026-05-28", "2026-06-03")).toBe("28 mai – 3 jun 2026");
  });

  it("mostra os dois anos quando o intervalo vira o ano", () => {
    expect(formatRange("2026-12-28", "2027-01-03")).toBe("28 dez 2026 – 3 jan 2027");
  });
});

describe("isBefore / isInside", () => {
  it("compara datas", () => {
    expect(isBefore("2026-05-10", "2026-05-17")).toBe(true);
    expect(isBefore("2026-05-17", "2026-05-10")).toBe(false);
  });

  it("as pontas não contam como interior", () => {
    expect(isInside("2026-05-10", "2026-05-10", "2026-05-17")).toBe(false);
    expect(isInside("2026-05-17", "2026-05-10", "2026-05-17")).toBe(false);
    expect(isInside("2026-05-12", "2026-05-10", "2026-05-17")).toBe(true);
  });

  it("intervalo aberto não tem interior", () => {
    expect(isInside("2026-05-12", "2026-05-10", "")).toBe(false);
    expect(isInside("2026-05-12", "", "2026-05-17")).toBe(false);
  });
});

describe("nextRange", () => {
  it("o primeiro clique vira a ida", () => {
    expect(nextRange({ start: "", end: "" }, "2026-05-10")).toEqual({
      start: "2026-05-10",
      end: ""
    });
  });

  it("o segundo clique fecha o intervalo", () => {
    expect(nextRange({ start: "2026-05-10", end: "" }, "2026-05-17")).toEqual({
      start: "2026-05-10",
      end: "2026-05-17"
    });
  });

  it("clicar antes da ida recomeça dali", () => {
    expect(nextRange({ start: "2026-05-10", end: "" }, "2026-05-04")).toEqual({
      start: "2026-05-04",
      end: ""
    });
  });

  it("com intervalo fechado, o clique recomeça", () => {
    expect(nextRange({ start: "2026-05-10", end: "2026-05-17" }, "2026-05-20")).toEqual({
      start: "2026-05-20",
      end: ""
    });
  });

  it("clicar no mesmo dia da ida fecha um intervalo de um dia", () => {
    expect(nextRange({ start: "2026-05-10", end: "" }, "2026-05-10")).toEqual({
      start: "2026-05-10",
      end: "2026-05-10"
    });
  });
});

describe("parseMonthKey / toMonthKey", () => {
  it("lê a chave de mês", () => {
    expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
  });

  it("escreve com zero à esquerda", () => {
    expect(toMonthKey({ year: 2026, month: 3 })).toBe("2026-03");
  });

  it("ida e volta preserva o valor", () => {
    expect(toMonthKey(parseMonthKey("2027-11"))).toBe("2027-11");
  });
});

describe("todayIso", () => {
  it("devolve a data de hoje em ISO curto, em UTC", () => {
    expect(todayIso(new Date("2026-09-04T23:30:00Z"))).toBe("2026-09-04");
  });

  it("usa o relógio quando não recebe data", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("currentMonth", () => {
  it("devolve ano e mês de hoje", () => {
    expect(currentMonth(new Date("2026-09-04T12:00:00Z"))).toEqual({ year: 2026, month: 9 });
  });

  it("usa o relógio quando não recebe data", () => {
    const now = currentMonth();
    expect(now.month).toBeGreaterThanOrEqual(1);
    expect(now.month).toBeLessThanOrEqual(12);
  });
});

describe("isPastMonth", () => {
  const hoje = { year: 2026, month: 9 };

  // O mês corrente não é passado: quem viaja dia 20 escolhe setembro em
  // setembro. Barrá-lo tiraria a opção mais provável de quem decide em cima da
  // hora.
  it("aceita o mês corrente", () => {
    expect(isPastMonth({ year: 2026, month: 9 }, hoje)).toBe(false);
  });

  it("recusa o mês anterior", () => {
    expect(isPastMonth({ year: 2026, month: 8 }, hoje)).toBe(true);
  });

  it("aceita o mês seguinte", () => {
    expect(isPastMonth({ year: 2026, month: 10 }, hoje)).toBe(false);
  });

  // Foi exatamente este caso que criou a viagem quebrada: maio, com 2026 na
  // tela, em setembro de 2026.
  it("recusa um mês anterior do mesmo ano", () => {
    expect(isPastMonth({ year: 2026, month: 5 }, hoje)).toBe(true);
  });

  it("recusa qualquer mês de um ano anterior", () => {
    expect(isPastMonth({ year: 2025, month: 12 }, hoje)).toBe(true);
  });

  it("aceita qualquer mês de um ano seguinte", () => {
    expect(isPastMonth({ year: 2027, month: 1 }, hoje)).toBe(false);
  });
});
