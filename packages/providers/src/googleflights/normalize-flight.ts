import {
  flightOfferSchema,
  flightPriceContextSchema,
  type FlightOffer,
  type FlightPriceContext
} from "@farol/shared";
import { GoogleFlightsParseError } from "./payload.js";

// O payload do Google Flights é posicional: não há nomes de campo, só índices
// dentro de arrays aninhados. Os nomes abaixo são o mapa dessas posições —
// mudá-los não muda nada, mas mudar os números muda tudo. Índices confirmados
// contra as fixtures em __fixtures__.
//
// Nível 1 — payload[2][0] e payload[3][0] são as duas listas de ofertas
// ("melhores voos" e "outros voos"). payload[5] é o contexto de preço.
const LIST_INDEXES = [2, 3] as const;
const PRICE_CONTEXT_INDEX = 5;

// Nível 2 — cada item da lista: [voo, preço, ...]
const I_FLIGHT = 0;
const I_PRICE = 1;

// Nível 3 — o voo: [código da cia, nomes das cias, trechos, ...]
const I_CARRIER = 0;
const I_CARRIER_NAMES = 1;
const I_LEGS = 2;

// Nível 4 — cada trecho.
const I_FROM_CODE = 3;
const I_FROM_NAME = 4;
const I_TO_NAME = 5;
const I_TO_CODE = 6;
const I_DEPART_TIME = 8;
const I_ARRIVE_TIME = 10;
const I_DURATION = 11;
const I_DEPART_DATE = 20;
const I_ARRIVE_DATE = 21;
const I_FLIGHT_NUMBER = 22;

// Contexto de preço: [_, mais barato, típico, delta, piso, teto, ...série]
const I_CHEAPEST = 1;
const I_TYPICAL = 2;
const I_DELTA = 3;
const I_BAND_LOW = 4;
const I_BAND_HIGH = 5;
const I_HISTORY = 10;

const MINUTE_MS = 60_000;

export interface GoogleOfferContext {
  currency: string;
  /** URL que reproduz exatamente esta busca no Google Flights. */
  searchUrl: string;
}

function fail(what: string): never {
  throw new GoogleFlightsParseError(
    `o payload do Google Flights não tem ${what} onde esperado — o layout mudou`
  );
}

function at(row: unknown, index: number): unknown {
  return Array.isArray(row) ? row[index] : undefined;
}

/** Valores de preço vêm embrulhados: [null, 1997]. */
function amount(row: unknown): number | null {
  const value = at(row, 1);
  return typeof value === "number" ? value : null;
}

// O Google omite componentes zerados: [8] é 08:00 e [null, 31] é 00:31. Um
// acesso direto a [0]/[1] leria undefined e produziria NaN na data.
function clockPart(time: unknown, index: number): number {
  const value = at(time, index);
  return typeof value === "number" ? value : 0;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

interface Stamp {
  iso: string;
  /** Minutos desde a época, tratando o horário como se fosse UTC. Só serve
   *  para medir intervalos dentro de um mesmo aeroporto — ver duração. */
  naiveMinutes: number;
}

function stamp(date: unknown, time: unknown, what: string): Stamp {
  if (!Array.isArray(date) || typeof date[0] !== "number") {
    fail(what);
  }
  const [year, month, day] = date as number[];
  const hour = clockPart(time, 0);
  const minute = clockPart(time, 1);
  return {
    iso: `${year}-${pad(month!)}-${pad(day!)}T${pad(hour)}:${pad(minute)}:00`,
    naiveMinutes: Date.UTC(year!, month! - 1, day!, hour, minute) / MINUTE_MS
  };
}

interface Leg {
  fromCode: string;
  fromName: string | null;
  toCode: string;
  toName: string | null;
  depart: Stamp;
  arrive: Stamp;
  durationMinutes: number;
  flightNumber: string | null;
}

function readLeg(raw: unknown): Leg {
  const fromCode = at(raw, I_FROM_CODE);
  const toCode = at(raw, I_TO_CODE);
  const duration = at(raw, I_DURATION);
  if (typeof fromCode !== "string" || typeof toCode !== "string" || typeof duration !== "number") {
    fail("os códigos e a duração de um trecho");
  }
  const number = at(at(raw, I_FLIGHT_NUMBER), 1);
  return {
    fromCode,
    toCode,
    fromName: typeof at(raw, I_FROM_NAME) === "string" ? (at(raw, I_FROM_NAME) as string) : null,
    toName: typeof at(raw, I_TO_NAME) === "string" ? (at(raw, I_TO_NAME) as string) : null,
    depart: stamp(at(raw, I_DEPART_DATE), at(raw, I_DEPART_TIME), "a partida de um trecho"),
    arrive: stamp(at(raw, I_ARRIVE_DATE), at(raw, I_ARRIVE_TIME), "a chegada de um trecho"),
    durationMinutes: duration,
    flightNumber: typeof number === "string" ? number : null
  };
}

// Tempo de porta a porta. A diferença entre o relógio na partida e o relógio na
// chegada não serve: são fusos diferentes, e GRU 00:25 → LIS 16:55 daria 16h30
// onde o voo leva 13h30. Já a conexão acontece dentro de um mesmo aeroporto,
// então ali a subtração ingênua é exata — some os trechos e as conexões.
function totalDuration(legs: Leg[]): number {
  let total = 0;
  legs.forEach((leg, index) => {
    total += leg.durationMinutes;
    const previous = legs[index - 1];
    if (previous !== undefined) {
      total += leg.depart.naiveMinutes - previous.arrive.naiveMinutes;
    }
  });
  return total;
}

function readOffer(raw: unknown, ctx: GoogleOfferContext): FlightOffer {
  const flight = at(raw, I_FLIGHT);
  const price = amount(at(at(raw, I_PRICE), 0));
  if (price === null) {
    fail("o preço de uma oferta");
  }

  const rawLegs = at(flight, I_LEGS);
  if (!Array.isArray(rawLegs) || rawLegs.length === 0) {
    fail("os trechos de uma oferta");
  }
  const legs = rawLegs.map(readLeg);
  const first = legs[0]!;
  const last = legs[legs.length - 1]!;

  const carrier = at(flight, I_CARRIER);
  const names = at(flight, I_CARRIER_NAMES);
  const carrierNames = Array.isArray(names) ? names.filter((n): n is string => typeof n === "string") : [];

  // Companhias diferentes na mesma oferta viram uma linha só: a UI mostra um
  // nome, e "LATAM · TAP" é mais honesto que escolher a primeira.
  const carrierName = carrierNames.length === 0 ? null : carrierNames.join(" · ");

  const numbers = legs.map((leg) => leg.flightNumber ?? "?").join("-");

  return flightOfferSchema.parse({
    id: `gf:${String(carrier)}:${numbers}:${first.depart.iso.slice(0, 10)}:${price}`,
    price,
    currency: ctx.currency,
    carrier: typeof carrier === "string" && carrier !== "" ? carrier : "multi",
    carrierName,
    originIata: first.fromCode,
    originName: first.fromName,
    destinationIata: last.toCode,
    destinationName: last.toName,
    stops: legs.length - 1,
    // Os trechos já estão parseados aqui; publicá-los é o que deixa a tela
    // distinguir "via Santiago" de "via Doha". Antes eram descartados, e a
    // contagem de escalas era tudo que sobrevivia do caminho.
    segments: legs.map((leg) => ({
      fromIata: leg.fromCode,
      fromName: leg.fromName,
      toIata: leg.toCode,
      toName: leg.toName,
      departAt: leg.depart.iso,
      arriveAt: leg.arrive.iso,
      durationMinutes: leg.durationMinutes,
      flightNumber: leg.flightNumber
    })),
    departAt: first.depart.iso,
    arriveAt: last.arrive.iso,
    // Na ida e volta esta resposta traz só o trecho de ida — o preço já é o
    // total, mas o horário da volta só existe depois de escolher a ida no
    // próprio Google. Inventar um horário aqui seria pior que não ter.
    returnAt: null,
    durationMinutes: totalDuration(legs),
    // O Google Flights não expõe link por oferta sem um token opaco de sessão.
    // O link da busca reproduz exatamente esta consulta, com estes preços.
    deepLink: ctx.searchUrl
  });
}

export function normalizeOffers(payload: unknown[], ctx: GoogleOfferContext): FlightOffer[] {
  const byId = new Map<string, FlightOffer>();
  for (const index of LIST_INDEXES) {
    const list = at(payload[index], 0);
    if (!Array.isArray(list)) {
      continue;
    }
    for (const raw of list) {
      const offer = readOffer(raw, ctx);
      byId.set(offer.id, offer);
    }
  }
  // A ordem do Google intercala duas listas com critérios diferentes, e a mais
  // barata costuma ser a segunda. Ordenar por preço é o que faz a leitura das
  // duas listas valer alguma coisa.
  return [...byId.values()].sort((a, b) => a.price - b.price);
}

export function normalizePriceContext(
  payload: unknown[],
  currency: string
): FlightPriceContext | null {
  const raw = payload[PRICE_CONTEXT_INDEX];
  const cheapest = amount(at(raw, I_CHEAPEST));
  const typical = amount(at(raw, I_TYPICAL));
  const delta = amount(at(raw, I_DELTA));
  const bandLow = amount(at(raw, I_BAND_LOW));
  const bandHigh = amount(at(raw, I_BAND_HIGH));
  if (cheapest === null || typical === null || delta === null || bandLow === null || bandHigh === null) {
    return null;
  }

  const series = at(at(raw, I_HISTORY), 0);
  const history: FlightPriceContext["history"] = [];
  if (Array.isArray(series)) {
    for (const point of series) {
      const millis = at(point, 0);
      const price = at(point, 1);
      // Dias sem cotação vêm com preço nulo. Deixar passar viraria um zero no
      // gráfico, que lê como "voo de graça" em vez de "não sei".
      if (typeof millis === "number" && typeof price === "number") {
        history.push({ at: new Date(millis).toISOString().slice(0, 10), price });
      }
    }
  }

  return flightPriceContextSchema.parse({
    cheapest,
    typical,
    delta,
    bandLow,
    bandHigh,
    currency,
    history
  });
}
