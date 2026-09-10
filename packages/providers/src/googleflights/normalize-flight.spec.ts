import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GoogleFlightsParseError } from "./payload.js";
import { normalizeOffers, normalizePriceContext } from "./normalize-flight.js";

function fixture(name: string): unknown[] {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}.json`, import.meta.url)), "utf8")
  ) as unknown[];
}

const ONE_WAY = fixture("one-way");
const ROUND_TRIP = fixture("round-trip");
const NO_FLIGHTS = fixture("no-flights");

const ctx = { currency: "BRL", searchUrl: "https://www.google.com/travel/flights?tfs=abc" };

describe("normalizeOffers", () => {
  it("lê as ofertas da busca de ida", () => {
    const offers = normalizeOffers(ONE_WAY, ctx);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0]!.originIata).toBe("GRU");
    expect(offers[0]!.destinationIata).toBe("LIS");
    expect(offers[0]!.currency).toBe("BRL");
  });

  // O Google devolve duas listas: "melhores voos" e "outros voos". O
  // fast-flights lê só uma delas e por isso perde o mais barato — nesta rota,
  // R$ 1.997 contra R$ 2.562.
  it("junta as duas listas e devolve o mais barato primeiro", () => {
    const offers = normalizeOffers(ONE_WAY, ctx);
    const soPrimeiraLista = normalizeOffers([...ONE_WAY.slice(0, 2), null, ...ONE_WAY.slice(3)], ctx);
    expect(offers.length).toBeGreaterThan(soPrimeiraLista.length);
    expect(offers[0]!.price).toBeLessThan(Math.min(...soPrimeiraLista.map((o) => o.price)));
    expect([...offers].sort((a, b) => a.price - b.price)).toEqual(offers);
  });

  it("não repete a mesma oferta quando ela aparece nas duas listas", () => {
    const ids = normalizeOffers(ONE_WAY, ctx).map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("conta as escalas pelos trechos", () => {
    const comEscala = normalizeOffers(ONE_WAY, ctx).find((o) => o.stops > 0);
    expect(comEscala).toBeDefined();
    expect(comEscala!.stops).toBe(1);
  });

  it("publica os trechos, um a mais que as escalas", () => {
    const comEscala = normalizeOffers(ONE_WAY, ctx).find((o) => o.stops > 0)!;
    expect(comEscala.segments).toHaveLength(comEscala.stops + 1);
    expect(comEscala.segments[0]!.fromIata).toBe(comEscala.originIata);
    expect(comEscala.segments.at(-1)!.toIata).toBe(comEscala.destinationIata);
  });

  // O hub é a informação que o `stops` apaga: "via Casablanca" e "via Doha"
  // são a mesma contagem e viagens completamente diferentes.
  it("o hub intermediário não é a origem nem o destino", () => {
    const comEscala = normalizeOffers(ONE_WAY, ctx).find((o) => o.stops > 0)!;
    const hub = comEscala.segments[0]!.toIata;
    expect(hub).not.toBe(comEscala.originIata);
    expect(hub).not.toBe(comEscala.destinationIata);
  });

  it("o voo direto tem um trecho só", () => {
    const direto = normalizeOffers(ONE_WAY, ctx).find((o) => o.stops === 0)!;
    expect(direto.segments).toHaveLength(1);
    expect(direto.segments[0]!.flightNumber).not.toBeUndefined();
  });

  // A soma ingênua chegada − partida daria 16h30 nesta rota: são horários
  // locais de fusos diferentes. A conta certa é a soma dos trechos mais as
  // conexões, que acontecem sempre dentro de um mesmo aeroporto.
  it("soma a duração pelos trechos e conexões, não pelo relógio local", () => {
    const royalAirMaroc = normalizeOffers(ONE_WAY, ctx).find(
      (o) => o.carrierName === "Royal Air Maroc"
    );
    expect(royalAirMaroc!.departAt).toBe("2026-11-15T00:25:00");
    expect(royalAirMaroc!.arriveAt).toBe("2026-11-15T16:55:00");
    expect(royalAirMaroc!.durationMinutes).toBe(810);
  });

  it("preenche companhia e nomes de aeroporto", () => {
    const offer = normalizeOffers(ONE_WAY, ctx).find((o) => o.carrier === "AT")!;
    expect(offer.carrierName).toBe("Royal Air Maroc");
    expect(offer.originName).toMatch(/Guarulhos/);
    expect(offer.destinationName).not.toBeNull();
  });

  it("aponta o deep link para a própria busca no Google", () => {
    for (const offer of normalizeOffers(ONE_WAY, ctx)) {
      expect(offer.deepLink).toBe(ctx.searchUrl);
    }
  });

  // Na ida e volta o Google só devolve o trecho de ida nesta requisição: o
  // preço já é o total, mas a volta só aparece depois de escolher a ida.
  it("na ida e volta traz o preço total e deixa returnAt nulo", () => {
    const offers = normalizeOffers(ROUND_TRIP, ctx);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.returnAt).toBeNull();
      expect(offer.destinationIata).toBe("LIS");
    }
    expect(Math.min(...offers.map((o) => o.price))).toBeGreaterThan(
      Math.min(...normalizeOffers(ONE_WAY, ctx).map((o) => o.price))
    );
  });

  it("devolve lista vazia quando a rota não tem voo", () => {
    expect(normalizeOffers(NO_FLIGHTS, ctx)).toEqual([]);
  });

  // Um trecho com formato inesperado significa que o Google mexeu no layout.
  // Pular a oferta em silêncio esconderia isso e devolveria meia lista como se
  // fosse a lista inteira; falhar deixa o fallback assumir e o job noturno
  // acusar.
  it("falha em vez de pular uma oferta com formato inesperado", () => {
    const quebrado = structuredClone(ONE_WAY) as unknown[];
    (quebrado[2] as unknown[][])[0]![0] = [null, [], "nao e uma lista de trechos"];
    expect(() => normalizeOffers(quebrado, ctx)).toThrow(GoogleFlightsParseError);
  });
});

describe("normalizePriceContext", () => {
  it("lê o preço mais barato, o típico e a faixa", () => {
    const ctxPreco = normalizePriceContext(ONE_WAY, "BRL")!;
    expect(ctxPreco.cheapest).toBe(1997);
    expect(ctxPreco.typical).toBe(1954);
    expect(ctxPreco.delta).toBe(-44);
    expect(ctxPreco.bandLow).toBe(1900);
    expect(ctxPreco.bandHigh).toBe(2100);
    expect(ctxPreco.currency).toBe("BRL");
  });

  it("lê a série histórica em data ISO", () => {
    const { history } = normalizePriceContext(ONE_WAY, "BRL")!;
    expect(history.length).toBeGreaterThan(20);
    expect(history[0]!.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(history[0]!.price).toBeGreaterThan(0);
  });

  it("devolve nulo quando a rota não tem contexto de preço", () => {
    expect(normalizePriceContext(NO_FLIGHTS, "BRL")).toBeNull();
  });

  // A série tem buracos: dias sem cotação vêm como null e não podem virar
  // preço zero num gráfico.
  it("descarta pontos sem preço", () => {
    const comBuraco = structuredClone(ONE_WAY) as unknown[];
    const serie = (comBuraco[5] as unknown[])[10] as unknown[][];
    serie[0] = [[1783220400000, null], ...serie[0]!.slice(1)];
    expect(normalizePriceContext(comBuraco, "BRL")!.history.length).toBe(
      normalizePriceContext(ONE_WAY, "BRL")!.history.length - 1
    );
  });
});

// Um payload sintético mínimo, com as posições que o normalizador lê. Serve
// para exercitar formato inesperado sem ter que corromper uma fixture de 50 KB
// e ficar adivinhando o que a corrupção atingiu.
function leg(over: Record<number, unknown> = {}): unknown[] {
  const row: unknown[] = new Array(23).fill(null);
  row[3] = "GRU";
  row[4] = "Guarulhos";
  row[5] = "Lisboa";
  row[6] = "LIS";
  row[8] = [10, 30];
  row[10] = [22, 5];
  row[11] = 575;
  row[20] = [2026, 11, 15];
  row[21] = [2026, 11, 15];
  row[22] = ["TP", "088", null, "TAP"];
  for (const [index, value] of Object.entries(over)) {
    row[Number(index)] = value;
  }
  return row;
}

function payloadWith(flight: unknown[], price: unknown = [[null, 1000]]): unknown[] {
  const payload: unknown[] = new Array(6).fill(null);
  payload[2] = [[[flight, price]]];
  return payload;
}

const flightOf = (legs: unknown[], carrier: unknown = "TP", names: unknown = ["TAP"]) =>
  [carrier, names, legs] as unknown[];

describe("normalizeOffers com payload fora do formato", () => {
  const one = (over: Record<number, unknown> = {}) => flightOf([leg(over)]);

  it("aceita o payload sintético de referência", () => {
    const [offer] = normalizeOffers(payloadWith(one()), ctx);
    expect(offer!.departAt).toBe("2026-11-15T10:30:00");
    expect(offer!.arriveAt).toBe("2026-11-15T22:05:00");
    expect(offer!.durationMinutes).toBe(575);
  });

  it("falha sem preço", () => {
    expect(() => normalizeOffers(payloadWith(one(), [[null, null]]), ctx)).toThrow(/preço/);
  });

  it("falha quando os trechos não são uma lista", () => {
    expect(() => normalizeOffers(payloadWith(flightOf("nada" as unknown as unknown[])), ctx)).toThrow(
      /trechos/
    );
  });

  it("falha quando a lista de trechos está vazia", () => {
    expect(() => normalizeOffers(payloadWith(flightOf([])), ctx)).toThrow(/trechos/);
  });

  it("falha quando um trecho perde o código de aeroporto", () => {
    expect(() => normalizeOffers(payloadWith(one({ 3: null })), ctx)).toThrow(/duração/);
  });

  it("falha quando um trecho perde a duração", () => {
    expect(() => normalizeOffers(payloadWith(one({ 11: "muito" })), ctx)).toThrow(/duração/);
  });

  it("falha quando a data de partida não tem forma de data", () => {
    expect(() => normalizeOffers(payloadWith(one({ 20: "2026-11-15" })), ctx)).toThrow(/partida/);
  });

  it("falha quando a data de chegada não tem forma de data", () => {
    expect(() => normalizeOffers(payloadWith(one({ 21: [] })), ctx)).toThrow(/chegada/);
  });

  // Nome de aeroporto é enfeite: sem ele a UI mostra o código, e derrubar a
  // busca inteira por causa disso seria desproporcional.
  it("segue sem os nomes de aeroporto", () => {
    const [offer] = normalizeOffers(payloadWith(one({ 4: null, 5: 0 })), ctx);
    expect(offer!.originName).toBeNull();
    expect(offer!.destinationName).toBeNull();
    expect(offer!.originIata).toBe("GRU");
  });

  it("marca o trecho sem número de voo no id", () => {
    const [offer] = normalizeOffers(payloadWith(one({ 22: null })), ctx);
    expect(offer!.id).toContain(":?:");
  });

  it("junta as companhias quando a oferta tem mais de uma", () => {
    const [offer] = normalizeOffers(payloadWith(flightOf([leg()], "TP", ["TAP", "LATAM"])), ctx);
    expect(offer!.carrierName).toBe("TAP · LATAM");
  });

  it("deixa a companhia nula quando o payload não nomeia nenhuma", () => {
    expect(normalizeOffers(payloadWith(flightOf([leg()], "TP", [])), ctx)[0]!.carrierName).toBeNull();
    expect(
      normalizeOffers(payloadWith(flightOf([leg()], "TP", null)), ctx)[0]!.carrierName
    ).toBeNull();
  });

  // Ofertas com companhias de grupos diferentes vêm sem código único. "multi"
  // é o que o próprio Google usa nesse caso.
  it("chama de multi a oferta sem código de companhia", () => {
    expect(normalizeOffers(payloadWith(flightOf([leg()], null)), ctx)[0]!.carrier).toBe("multi");
    expect(normalizeOffers(payloadWith(flightOf([leg()], "")), ctx)[0]!.carrier).toBe("multi");
  });

  // Componentes zerados vêm omitidos: [8] é 08:00 e [null, 31] é 00:31.
  it("expande as horas que o Google omite por serem zero", () => {
    const [offer] = normalizeOffers(payloadWith(one({ 8: [8], 10: [null, 31] })), ctx);
    expect(offer!.departAt).toBe("2026-11-15T08:00:00");
    expect(offer!.arriveAt).toBe("2026-11-15T00:31:00");
  });
});

describe("normalizePriceContext sem contexto", () => {
  it("devolve nulo quando falta qualquer um dos cinco valores", () => {
    const base = [null, [null, 1], [null, 2], [null, 3], [null, 4], [null, 5]];
    for (let index = 1; index <= 5; index += 1) {
      const raw = [...base];
      raw[index] = null;
      const payload: unknown[] = new Array(6).fill(null);
      payload[5] = raw;
      expect(normalizePriceContext(payload, "BRL")).toBeNull();
    }
  });

  it("devolve histórico vazio quando a série não vem", () => {
    const payload: unknown[] = new Array(6).fill(null);
    payload[5] = [null, [null, 10], [null, 12], [null, -2], [null, 9], [null, 15]];
    expect(normalizePriceContext(payload, "BRL")!.history).toEqual([]);
  });
});
