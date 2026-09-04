// Codificador do parâmetro `tfs` do Google Flights.
//
// O `tfs` é uma mensagem protobuf `Info` serializada e passada em base64 na
// query string. O schema está no fast-flights (`pb/flights.proto`); usamos o
// subconjunto que a busca do Farol precisa.
//
// Não há dependência de protobuf aqui de propósito: a mensagem é rasa (só
// varints e campos de tamanho conhecido) e trazer `protobufjs` custaria uma
// árvore inteira de código gerado para escrever ~40 bytes.

export type SeatClass = "economy" | "premium-economy" | "business" | "first";

export interface TfsLeg {
  /** Data de partida em ISO curto: "2026-11-15". */
  date: string;
  fromIata: string;
  toIata: string;
}

export interface TfsQuery {
  /** Uma perna é ida; duas são ida e volta. Mais que isso o Farol não emite. */
  legs: TfsLeg[];
  adults: number;
  children?: number;
  seat?: SeatClass;
  maxStops?: number;
  /** Teto de preço na moeda da busca. */
  maxPrice?: number;
}

// Números dos campos, do flights.proto.
const F_DATE = 2;
const F_MAX_STOPS = 5;
const F_FROM = 13;
const F_TO = 14;
const F_AIRPORT = 2;
const F_LEGS = 3;
const F_PASSENGERS = 8;
const F_SEAT = 9;
const F_MAX_PRICE = 12;
const F_TRIP = 19;

const SEAT_CODE: Record<SeatClass, number> = {
  economy: 1,
  "premium-economy": 2,
  business: 3,
  first: 4
};

const PASSENGER_ADULT = 1;
const PASSENGER_CHILD = 2;
const TRIP_ROUND = 1;
const TRIP_ONE_WAY = 2;

/** Teto do próprio Google: buscas com mais de 9 passageiros são recusadas lá. */
const MAX_PASSENGERS = 9;

function varint(value: number): Buffer {
  const bytes: number[] = [];
  let rest = value;
  for (;;) {
    const byte = rest & 0x7f;
    rest >>>= 7;
    bytes.push(rest === 0 ? byte : byte | 0x80);
    if (rest === 0) {
      return Buffer.from(bytes);
    }
  }
}

/** Campo varint (wire type 0). */
function num(field: number, value: number): Buffer {
  return Buffer.concat([varint((field << 3) | 0), varint(value)]);
}

/** Campo de tamanho declarado (wire type 2). */
function bytes(field: number, payload: Buffer): Buffer {
  return Buffer.concat([varint((field << 3) | 2), varint(payload.length), payload]);
}

function text(field: number, value: string): Buffer {
  return bytes(field, Buffer.from(value, "utf8"));
}

function encodeLeg(leg: TfsLeg, maxStops: number | undefined): Buffer {
  const parts = [text(F_DATE, leg.date)];
  if (maxStops !== undefined) {
    parts.push(num(F_MAX_STOPS, maxStops));
  }
  parts.push(bytes(F_FROM, text(F_AIRPORT, leg.fromIata)));
  parts.push(bytes(F_TO, text(F_AIRPORT, leg.toIata)));
  return Buffer.concat(parts);
}

export function encodeTfs(query: TfsQuery): string {
  if (query.legs.length === 0) {
    throw new Error("a busca precisa de ao menos uma perna");
  }
  const children = query.children ?? 0;
  if (query.adults + children > MAX_PASSENGERS) {
    throw new Error(`o Google Flights aceita no máximo ${MAX_PASSENGERS} passageiros`);
  }

  const parts = query.legs.map((leg) => bytes(F_LEGS, encodeLeg(leg, query.maxStops)));

  // `passengers` é repetido e não empacotado: um campo por pessoa, não uma
  // contagem. Dois adultos são dois campos 8 com valor 1.
  for (let i = 0; i < query.adults; i += 1) {
    parts.push(num(F_PASSENGERS, PASSENGER_ADULT));
  }
  for (let i = 0; i < children; i += 1) {
    parts.push(num(F_PASSENGERS, PASSENGER_CHILD));
  }

  parts.push(num(F_SEAT, SEAT_CODE[query.seat ?? "economy"]));
  if (query.maxPrice !== undefined) {
    parts.push(num(F_MAX_PRICE, query.maxPrice));
  }
  parts.push(num(F_TRIP, query.legs.length > 1 ? TRIP_ROUND : TRIP_ONE_WAY));

  return Buffer.concat(parts).toString("base64");
}
