/** Lógica de calendário do DateRangeField. Datas são ISO "YYYY-MM-DD" e todo
 *  cálculo passa por UTC: com horário local, um fuso negativo joga a data para
 *  o dia anterior na virada do mês. */

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

export const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez"
];

export const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function toIso({ year, month }: YearMonth, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function parseIso(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dia da semana do dia 1, com domingo = 0. */
export function firstWeekday({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const zero = ym.month - 1 + delta;
  return { year: ym.year + Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 };
}

/** Semanas de 7 posições; `null` nas casas antes do dia 1 e depois do último. */
export function monthMatrix(ym: YearMonth): (string | null)[][] {
  const total = daysInMonth(ym);
  const offset = firstWeekday(ym);
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= total; day += 1) {
    cells.push(toIso(ym, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTHS_LONG[month - 1]} de ${year}`;
}

export function monthOf(iso: string): YearMonth {
  const { year, month } = parseIso(iso);
  return { year, month };
}

/** "10 – 17 mai 2026" · "28 mai – 3 jun 2026" · "28 dez 2026 – 3 jan 2027" */
export function formatRange(start: string, end: string): string {
  if (start === "") return "";
  const a = parseIso(start);
  if (end === "") return `${a.day} ${MONTHS_SHORT[a.month - 1]} ${a.year}`;
  const b = parseIso(end);
  const left =
    a.year !== b.year
      ? `${a.day} ${MONTHS_SHORT[a.month - 1]} ${a.year}`
      : a.month !== b.month
        ? `${a.day} ${MONTHS_SHORT[a.month - 1]}`
        : `${a.day}`;
  return `${left} – ${b.day} ${MONTHS_SHORT[b.month - 1]} ${b.year}`;
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

/** Estritamente entre as pontas — as pontas têm estilo próprio. */
export function isInside(iso: string, start: string, end: string): boolean {
  return start !== "" && end !== "" && iso > start && iso < end;
}

/** Um clique só: sem início, ou com intervalo fechado, começa de novo;
 *  clique antes do início vira o novo início. */
export function nextRange(
  { start, end }: { start: string; end: string },
  clicked: string
): { start: string; end: string } {
  if (start === "" || end !== "" || isBefore(clicked, start)) {
    return { start: clicked, end: "" };
  }
  return { start, end: clicked };
}

/** "2026-09" → { year: 2026, month: 9 }. */
export function parseMonthKey(key: string): YearMonth {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

/** { year: 2026, month: 9 } → "2026-09", o formato que o TripInput espera. */
export function toMonthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Hoje em ISO curto. Recebe a data para o teste poder fixar o relógio. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Ano e mês de hoje. Substitui qualquer ano cravado no código, que envelhece
 *  em silêncio e passa a oferecer meses que já passaram. */
export function currentMonth(now: Date = new Date()): YearMonth {
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** O mês já passou? O mês corrente não conta como passado — quem viaja dia 20
 *  escolhe setembro estando em setembro. */
export function isPastMonth(ym: YearMonth, today: YearMonth = currentMonth()): boolean {
  return ym.year < today.year || (ym.year === today.year && ym.month < today.month);
}
