# Busca por rota — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir buscar voo para um par origem-destino qualquer — sem passar pelo catálogo de destinos — respondendo "em que mês essa rota é mais barata" e "quais são os voos reais nessa data", com o caminho de cada oferta visível.

**Architecture:** O motor já é de rota: `priceCalendar`, `latestPrices` e `monthlyPrices` do provider recebem `RouteQuery`, não uma viagem. O trabalho é (a) parar de descartar os trechos que o normalizador do Google Flights já lê, (b) tirar a dependência de viagem do `routeSection` da `FlightsService`, (c) expor duas rotas HTTP num controller novo dentro do `FlightsModule` existente, e (d) uma página `/rotas` no web. Nenhum módulo novo, nenhuma tabela, nenhuma migration.

**Tech Stack:** TypeScript, NestJS, Next.js 15 (App Router), zod, Drizzle, Vitest, Supertest, Playwright, StrykerJS.

**Spec:** `docs/superpowers/specs/2026-09-09-busca-por-rota-design.md`

## Global Constraints

- **Cobertura 100%** (statements/branches/functions/lines) por pacote. O gate é por pacote, não média do monorepo.
- **Mutation score ≥ 90** por pacote.
- **TDD**: o `.spec.ts` vem antes da implementação, sempre.
- **Nenhuma migration, nenhuma tabela nova, nenhum módulo Nest novo.**
- As duas rotas ficam **atrás do `AuthGuard` global**. Nada de `@Public()`.
- `segments` é `.default([])` — lista vazia significa "o provider não informa o caminho", nunca um caminho inventado.
- **Sem fallback automático para hub.** Quando a rota pedida não tem histórico, a resposta é vazia e a tela diz isso; não se troca a rota da pessoa em silêncio.
- Comentários, mensagens de erro e textos de tela em **português**.
- Branch: `rafaignaulin/busca-por-rota`. Commits pequenos e frequentes.

---

## File Structure

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/flights/routes.controller.ts` | Duas rotas HTTP de busca por rota livre + os schemas de query |
| `apps/api/src/flights/routes.controller.spec.ts` | Unidade do controller: delegação e validação |
| `apps/api/test/routes.e2e-spec.ts` | E2E de API das duas rotas |
| `apps/web/src/lib/route-api.ts` | Cliente HTTP das duas rotas |
| `apps/web/src/lib/route-api.spec.ts` | Unidade do cliente |
| `apps/web/src/lib/route-form.ts` | Estado e validação do formulário, sem React |
| `apps/web/src/lib/route-form.spec.ts` | Unidade do formulário |
| `apps/web/src/app/rotas/page.tsx` | A tela |
| `apps/web/src/app/rotas/rotas.css` | Estilo da tela |
| `apps/web/src/components/routes/RouteForm.tsx` | Formulário |
| `apps/web/src/components/routes/RouteForm.spec.tsx` | Unidade do formulário |
| `apps/web/src/components/routes/MonthList.tsx` | Bloco dos meses |
| `apps/web/src/components/routes/MonthList.spec.tsx` | Unidade do bloco |
| `apps/web/src/components/routes/OfferList.tsx` | Bloco das ofertas, com os trechos |
| `apps/web/src/components/routes/OfferList.spec.tsx` | Unidade do bloco |
| `apps/web/e2e/routes.spec.ts` | Playwright do fluxo |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `packages/shared/src/flights.ts` | `flightSegmentSchema` novo; campo `segments` no `flightOfferSchema` |
| `packages/shared/src/flights.spec.ts` | Cobertura do campo novo |
| `packages/providers/src/googleflights/normalize-flight.ts` | `readOffer` passa os trechos adiante em vez de descartar |
| `packages/providers/src/googleflights/normalize-flight.spec.ts` | Cobertura dos trechos |
| `apps/api/src/flights/flights.service.ts` | `routeSection` sem viagem; `monthsByRoute` e `offersByRoute` novos |
| `apps/api/src/flights/flights.service.spec.ts` | Cobertura dos métodos novos |
| `apps/api/src/flights/flights.module.ts` | Registra o `RoutesController` |
| `apps/api/test/support/fake-providers.ts` | `segments` nas ofertas falsas |

A divisão do web em `lib/` (lógica pura, testável sem DOM) e `components/` (React) segue o que o projeto já faz — `lib/discovery-form.ts` ao lado de `components/discovery/`.

---

## Task 1: `segments[]` no `FlightOffer`

O caminho do voo já é lido e descartado. `readLeg` (`packages/providers/src/googleflights/normalize-flight.ts:114`) monta cada trecho inteiro e `readOffer` (`:150`) colapsa a lista em `stops: legs.length - 1`.

**Files:**
- Modify: `packages/shared/src/flights.ts`
- Modify: `packages/shared/src/flights.spec.ts`
- Modify: `packages/providers/src/googleflights/normalize-flight.ts:150-193`
- Modify: `packages/providers/src/googleflights/normalize-flight.spec.ts`
- Modify: `apps/api/test/support/fake-providers.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `flightSegmentSchema`, `type FlightSegment` e o campo `segments: FlightSegment[]` em `FlightOffer`, exportados por `@farol/shared`. As tarefas 3, 5 e 6 dependem disso.

- [ ] **Step 1: Escrever o teste do schema, que falha**

Em `packages/shared/src/flights.spec.ts`, acrescentar ao fim do arquivo:

```ts
describe("flightSegmentSchema", () => {
  const segment = {
    fromIata: "FLN",
    fromName: "Florianópolis",
    toIata: "SCL",
    toName: "Santiago",
    departAt: "2027-02-11T06:15:00",
    arriveAt: "2027-02-11T10:40:00",
    durationMinutes: 265,
    flightNumber: "LA755"
  };

  it("aceita um trecho completo", () => {
    expect(flightSegmentSchema.parse(segment)).toEqual(segment);
  });

  it("deixa nome e número de voo nulos quando o provider não informa", () => {
    const parsed = flightSegmentSchema.parse({
      fromIata: "FLN",
      toIata: "SCL",
      departAt: "2027-02-11T06:15:00",
      arriveAt: "2027-02-11T10:40:00",
      durationMinutes: 265
    });
    expect(parsed.fromName).toBeNull();
    expect(parsed.toName).toBeNull();
    expect(parsed.flightNumber).toBeNull();
  });

  it("recusa IATA que não tem três letras", () => {
    expect(() => flightSegmentSchema.parse({ ...segment, fromIata: "FL" })).toThrow();
  });
});

describe("flightOfferSchema com segments", () => {
  const offer = {
    id: "gf:LA:LA755-LA800:2027-02-11:6420",
    price: 6420,
    currency: "BRL",
    carrier: "LA",
    originIata: "FLN",
    destinationIata: "SYD",
    stops: 1,
    departAt: "2027-02-11T06:15:00",
    arriveAt: "2027-02-12T22:05:00",
    returnAt: null,
    durationMinutes: 2510,
    deepLink: "https://www.google.com/travel/flights?tfs=abc"
  };

  it("assume lista vazia quando o provider não informa o caminho", () => {
    expect(flightOfferSchema.parse(offer).segments).toEqual([]);
  });

  it("guarda os trechos quando o provider informa", () => {
    const parsed = flightOfferSchema.parse({
      ...offer,
      segments: [
        {
          fromIata: "FLN",
          toIata: "SCL",
          departAt: "2027-02-11T06:15:00",
          arriveAt: "2027-02-11T10:40:00",
          durationMinutes: 265
        }
      ]
    });
    expect(parsed.segments.map((s) => s.toIata)).toEqual(["SCL"]);
  });
});
```

Acrescentar `flightSegmentSchema` ao import do topo do arquivo (junto de `flightOfferSchema`).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/shared exec vitest run src/flights.spec.ts`
Expected: FAIL — `flightSegmentSchema is not exported` / `is not defined`.

- [ ] **Step 3: Implementar o schema**

Em `packages/shared/src/flights.ts`, logo **antes** de `export const flightOfferSchema`:

```ts
// Um trecho do voo: cada pouso entre a origem e o destino final. O Google
// Flights entrega isso em toda oferta; o Travelpayouts não entrega nenhum, só
// a contagem de escalas. Por isso a lista pode ser vazia — ver `segments`.
export const flightSegmentSchema = z.object({
  fromIata: z.string().length(3),
  fromName: z.string().min(1).nullable().default(null),
  toIata: z.string().length(3),
  toName: z.string().min(1).nullable().default(null),
  departAt: z.string().min(1),
  arriveAt: z.string().min(1),
  durationMinutes: z.number().int().min(0),
  flightNumber: z.string().min(1).nullable().default(null)
});
export type FlightSegment = z.infer<typeof flightSegmentSchema>;
```

E dentro de `flightOfferSchema`, logo depois de `stops`:

```ts
  // Por onde o voo passa. Numa rota longa isto é metade da decisão: quatro
  // horas em Santiago e quarenta e uma horas via Doha não são a mesma viagem
  // pelo mesmo preço. Vazio = o provider não informa o caminho, e a tela cai
  // em `stops` — mesmo acordo de `carrierName: null`, que mostra o código cru
  // em vez de um nome inventado.
  segments: z.array(flightSegmentSchema).default([]),
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/shared exec vitest run src/flights.spec.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste do normalizador, que falha**

Em `packages/providers/src/googleflights/normalize-flight.spec.ts`, acrescentar dentro do `describe("normalizeOffers")` existente:

```ts
  it("preenche os trechos com os aeroportos intermediários", () => {
    const offers = normalizeOffers(payload, ctx);
    const comEscala = offers.find((o) => o.stops > 0);
    expect(comEscala).toBeDefined();
    expect(comEscala!.segments).toHaveLength(comEscala!.stops + 1);
    expect(comEscala!.segments[0]!.fromIata).toBe(comEscala!.originIata);
    expect(comEscala!.segments.at(-1)!.toIata).toBe(comEscala!.destinationIata);
  });

  it("o hub intermediário não é a origem nem o destino", () => {
    const comEscala = normalizeOffers(payload, ctx).find((o) => o.stops > 0)!;
    const hub = comEscala.segments[0]!.toIata;
    expect(hub).not.toBe(comEscala.originIata);
    expect(hub).not.toBe(comEscala.destinationIata);
  });
```

`payload` e `ctx` já existem no arquivo — reusar exatamente os nomes que o `describe` usa hoje. Se o `describe` monta o payload por fixture, usar a mesma fixture.

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/providers exec vitest run src/googleflights/normalize-flight.spec.ts`
Expected: FAIL — `expected [] to have a length of 2`.

- [ ] **Step 7: Implementar**

Em `packages/providers/src/googleflights/normalize-flight.ts`, dentro do objeto passado a `flightOfferSchema.parse(...)` no `readOffer`, logo depois de `stops: legs.length - 1,`:

```ts
    // Os trechos já estão parseados aqui; publicá-los é o que deixa a tela
    // distinguir "via Santiago" de "via Doha". Antes eram descartados.
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
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/providers exec vitest run src/googleflights/normalize-flight.spec.ts`
Expected: PASS.

- [ ] **Step 9: Dar trechos às ofertas falsas**

Em `apps/api/test/support/fake-providers.ts`, na oferta `flt-cheap` de `FAKE_FLIGHT_OFFERS` (que tem `stops: 1`), acrescentar depois de `stops: 1,`:

```ts
    segments: [
      {
        fromIata: "GRU",
        fromName: "Sao Paulo-Guarulhos International Airport",
        toIata: "CDG",
        toName: "Paris Charles de Gaulle",
        departAt: "2026-09-10T18:30:00",
        arriveAt: "2026-09-11T09:50:00",
        durationMinutes: 680,
        flightNumber: "AF459"
      },
      {
        fromIata: "CDG",
        fromName: "Paris Charles de Gaulle",
        toIata: "LIS",
        toName: "Lisbon Airport",
        departAt: "2026-09-11T11:55:00",
        arriveAt: "2026-09-11T14:10:00",
        durationMinutes: 135,
        flightNumber: "AF1024"
      }
    ],
```

As demais ofertas falsas ficam sem `segments` — é o `.default([])` sendo exercitado de graça.

- [ ] **Step 10: Rodar os dois pacotes inteiros com cobertura**

Run: `pnpm --filter @farol/shared test && pnpm --filter @farol/providers test`
Expected: PASS, 100% nos dois.

- [ ] **Step 11: Commit**

```bash
git add packages/shared/src/flights.ts packages/shared/src/flights.spec.ts \
        packages/providers/src/googleflights/normalize-flight.ts \
        packages/providers/src/googleflights/normalize-flight.spec.ts \
        apps/api/test/support/fake-providers.ts
git commit -m "feat(shared): segments[] na oferta de voo

O readOffer já parseava cada trecho e descartava tudo em stops. Agora o
caminho vai junto: dá para distinguir via Santiago de via Doha.

Vazio quando o provider não informa (Travelpayouts só dá a contagem).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `routeSection` sem viagem

Hoje `FlightsService.routeSection()` recebe `userId`/`tripId`, resolve a viagem e joga tudo fora para ficar com `{ originIata, destinationIata }` e a contagem de passageiros. Esta tarefa inverte: `routeSection` passa a receber a rota pronta, e os métodos por-viagem resolvem a viagem e delegam.

**Files:**
- Modify: `apps/api/src/flights/flights.service.ts`
- Modify: `apps/api/src/flights/flights.service.spec.ts`

**Interfaces:**
- Consumes: `FlightOffer.segments` da Task 1 (indiretamente, via `enrich`).
- Produces:
  - `FlightsService.monthsByRoute(query: RouteQuery, passengers: number): Promise<ProviderSection<RouteDeal>>`
  - `FlightsService.offersByRoute(params: FlightSearchParams): Promise<ProviderSection<FlightOffer>>`

  A Task 3 chama exatamente esses dois nomes com essas assinaturas.

- [ ] **Step 1: Escrever os testes dos métodos novos, que falham**

Em `apps/api/src/flights/flights.service.spec.ts`, acrescentar um `describe` novo. Reusar o helper de construção de serviço que o arquivo já tem; se ele exigir `trips`, passar o mesmo fake, porque estes métodos não devem tocá-lo.

```ts
describe("busca por rota, sem viagem", () => {
  it("monthsByRoute pergunta ao provider sem resolver viagem nenhuma", async () => {
    const monthlyPrices = vi.fn().mockResolvedValue(FAKE_ROUTE_DEALS);
    const trips = { get: vi.fn() };
    const { service } = buildService({ provider: { monthlyPrices }, trips });

    const section = await service.monthsByRoute(
      { originIata: "FLN", destinationIata: "SYD" },
      2
    );

    expect(section.offers).toEqual(FAKE_ROUTE_DEALS);
    expect(monthlyPrices).toHaveBeenCalledWith({ originIata: "FLN", destinationIata: "SYD" }, 2);
    expect(trips.get).not.toHaveBeenCalled();
  });

  it("offersByRoute busca a data pedida e enriquece os nomes", async () => {
    const search = vi.fn().mockResolvedValue(FAKE_FLIGHT_OFFERS);
    const trips = { get: vi.fn() };
    const { service } = buildService({ provider: { search }, trips });
    const params = {
      originIata: "FLN",
      destinationIata: "SYD",
      departDate: "2027-02-11",
      adults: 1,
      children: 0
    };

    const section = await service.offersByRoute(params);

    expect(search).toHaveBeenCalledWith(params);
    expect(section.offers).toHaveLength(FAKE_FLIGHT_OFFERS.length);
    expect(trips.get).not.toHaveBeenCalled();
  });

  it("offersByRoute sem returnDate é ida só — o provider recebe undefined", async () => {
    const search = vi.fn().mockResolvedValue([]);
    const { service } = buildService({ provider: { search } });

    await service.offersByRoute({
      originIata: "FLN",
      destinationIata: "SYD",
      departDate: "2027-02-11",
      adults: 1,
      children: 0
    });

    expect(search.mock.calls[0]![0].returnDate).toBeUndefined();
  });

  it("provider fora do ar degrada a seção em vez de derrubar", async () => {
    const monthlyPrices = vi.fn().mockRejectedValue(new Error("provider caiu"));
    const { service } = buildService({ provider: { monthlyPrices } });

    await expect(
      service.monthsByRoute({ originIata: "FLN", destinationIata: "SYD" }, 1)
    ).resolves.toEqual({ offers: [], stale: false, fetchedAt: null, error: "unavailable" });
  });
});
```

`buildService` é o helper que o arquivo já usa para montar a `FlightsService` com fakes — reusar o nome exato que estiver lá. `FAKE_ROUTE_DEALS` e `FAKE_FLIGHT_OFFERS` vêm de `../../test/support/fake-providers`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/api exec vitest run src/flights/flights.service.spec.ts`
Expected: FAIL — `service.monthsByRoute is not a function`.

- [ ] **Step 3: Deixar `section` aceitar busca sem viagem**

Em `apps/api/src/flights/flights.service.ts`, o `tripId` do `section` só alimenta o log. Trocar a assinatura:

```ts
  private section<T>(
    tripId: string | null,
    endpoint: string,
    params: Record<string, unknown>,
    load: () => Promise<T[]>
  ): Promise<ProviderSection<T>> {
```

Nada mais muda no corpo: `degradeSection("flight_provider_failed", { endpoint, tripId }, ...)` continua igual, e `tripId: null` no log é a leitura honesta de "esta busca não pertence a viagem nenhuma".

- [ ] **Step 4: Inverter o `routeSection`**

Substituir o `routeSection` atual por estes dois:

```ts
  // A rota é tudo que os recortes de contexto precisam — RouteQuery não sabe o
  // que é uma viagem. Manter isto separado de quem resolve a viagem é o que
  // deixa a busca por rota livre reusar o mesmo caminho, com o mesmo cache.
  private routeSection<T>(
    tripId: string | null,
    query: RouteQuery,
    passengers: number,
    endpoint: string,
    call: (query: RouteQuery, passengers: number) => Promise<T[]>
  ): Promise<ProviderSection<T>> {
    return this.section(tripId, endpoint, { ...query, passengers }, () => call(query, passengers));
  }

  // Viagem → rota. Fica fora do degradeSection de propósito: viagem inexistente
  // é 404 e destino não escolhido é 422, não uma seção vazia.
  private async routeOf(
    userId: string,
    tripId: string
  ): Promise<{ query: RouteQuery; passengers: number }> {
    const trip = await this.trips.get(userId, tripId);
    const params = buildFlightParams(trip);
    return {
      query: { originIata: params.originIata, destinationIata: params.destinationIata },
      passengers: params.adults + params.children
    };
  }
```

- [ ] **Step 5: Repassar os três métodos por-viagem**

Substituir os corpos de `priceCalendar`, `latestPrices` e `monthlyPrices`:

```ts
  /** Preço por dia do mês — "melhor dia para sair". */
  async priceCalendar(userId: string, tripId: string): Promise<ProviderSection<RoutePriceSample>> {
    const { query, passengers } = await this.routeOf(userId, tripId);
    return this.routeSection(tripId, query, passengers, FLIGHT_ENDPOINTS.calendar, (q, n) =>
      this.provider.priceCalendar(q, n)
    );
  }

  /** Preços recentes da rota — a faixa que embasa o "está caro ou está barato". */
  async latestPrices(userId: string, tripId: string): Promise<ProviderSection<RoutePriceSample>> {
    const { query, passengers } = await this.routeOf(userId, tripId);
    return this.routeSection(tripId, query, passengers, FLIGHT_ENDPOINTS.latest, (q, n) =>
      this.provider.latestPrices(q, n)
    );
  }

  /** Melhor preço mês a mês — "quando ir". */
  async monthlyPrices(userId: string, tripId: string): Promise<ProviderSection<RouteDeal>> {
    const { query, passengers } = await this.routeOf(userId, tripId);
    return this.routeSection(tripId, query, passengers, FLIGHT_ENDPOINTS.monthly, (q, n) =>
      this.provider.monthlyPrices(q, n)
    );
  }
```

- [ ] **Step 6: Acrescentar os dois métodos de rota livre**

Logo depois de `cityDirections`:

```ts
  /** Melhor preço mês a mês de uma rota qualquer — responde "quando ir" sem
   *  exigir viagem, catálogo ou destino escolhido. */
  monthsByRoute(query: RouteQuery, passengers: number): Promise<ProviderSection<RouteDeal>> {
    return this.routeSection(null, query, passengers, FLIGHT_ENDPOINTS.monthly, (q, n) =>
      this.provider.monthlyPrices(q, n)
    );
  }

  /** Ofertas reais de uma rota e data quaisquer. `returnDate` ausente = ida só. */
  offersByRoute(params: FlightSearchParams): Promise<ProviderSection<FlightOffer>> {
    return this.section(null, FLIGHT_ENDPOINTS.search, { ...params }, async () =>
      this.enrich(await this.provider.search(params))
    );
  }
```

Acrescentar `FlightSearchParams` ao import de `@farol/shared` no topo do arquivo, e `RouteQuery` já está no import de `@farol/providers`.

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/api exec vitest run src/flights/flights.service.spec.ts`
Expected: PASS — inclusive os testes que já existiam. **Os testes antigos passarem sem alteração é o que prova que o refactor não mudou comportamento.** Se algum precisar mudar, parar e entender por quê antes de editar.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/flights/flights.service.ts apps/api/src/flights/flights.service.spec.ts
git commit -m "refactor(api): routeSection sem viagem, + monthsByRoute e offersByRoute

routeSection resolvia a viagem só para reduzi-la a {origin, destination}.
Agora recebe a rota pronta e quem tem viagem resolve antes e delega — o
que abre os mesmos recortes para busca por rota livre, com o mesmo cache
(a chave nunca teve tripId).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `RoutesController`

**Files:**
- Create: `apps/api/src/flights/routes.controller.ts`
- Create: `apps/api/src/flights/routes.controller.spec.ts`
- Create: `apps/api/test/routes.e2e-spec.ts`
- Modify: `apps/api/src/flights/flights.module.ts`

**Interfaces:**
- Consumes: `FlightsService.monthsByRoute(query, passengers)` e `FlightsService.offersByRoute(params)` da Task 2.
- Produces: `GET /routes/months` e `GET /routes/offers`. A Task 4 chama esses dois caminhos.

- [ ] **Step 1: Escrever a unidade do controller, que falha**

Criar `apps/api/src/flights/routes.controller.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import {
  RoutesController,
  routeMonthsQuerySchema,
  routeOffersQuerySchema
} from "./routes.controller";
import type { FlightsService } from "./flights.service";

const emptySection = { offers: [], stale: false, fetchedAt: null, error: null };

function controllerWith(over: Partial<Record<"monthsByRoute" | "offersByRoute", ReturnType<typeof vi.fn>>> = {}) {
  const service = {
    monthsByRoute: over.monthsByRoute ?? vi.fn().mockResolvedValue(emptySection),
    offersByRoute: over.offersByRoute ?? vi.fn().mockResolvedValue(emptySection)
  };
  return {
    controller: new RoutesController(service as unknown as FlightsService),
    service
  };
}

describe("routeMonthsQuerySchema", () => {
  it("converte os números que chegam como texto na query", () => {
    expect(
      routeMonthsQuerySchema.parse({ origin: "FLN", destination: "SYD", adults: "2", children: "1" })
    ).toEqual({ origin: "FLN", destination: "SYD", adults: 2, children: 1 });
  });

  it("assume um adulto e nenhuma criança", () => {
    const parsed = routeMonthsQuerySchema.parse({ origin: "FLN", destination: "SYD" });
    expect(parsed.adults).toBe(1);
    expect(parsed.children).toBe(0);
  });

  it("recusa IATA fora de três letras", () => {
    expect(() => routeMonthsQuerySchema.parse({ origin: "FL", destination: "SYD" })).toThrow();
  });

  it("recusa zero adultos", () => {
    expect(() =>
      routeMonthsQuerySchema.parse({ origin: "FLN", destination: "SYD", adults: "0" })
    ).toThrow();
  });
});

describe("routeOffersQuerySchema", () => {
  const base = { origin: "FLN", destination: "SYD", depart: "2027-02-11" };

  it("aceita ida só", () => {
    expect(routeOffersQuerySchema.parse(base).return).toBeUndefined();
  });

  it("aceita ida e volta", () => {
    expect(routeOffersQuerySchema.parse({ ...base, return: "2027-02-25" }).return).toBe("2027-02-25");
  });

  it("exige a data de ida", () => {
    expect(() => routeOffersQuerySchema.parse({ origin: "FLN", destination: "SYD" })).toThrow();
  });

  it("recusa data que não é ISO", () => {
    expect(() => routeOffersQuerySchema.parse({ ...base, depart: "11/02/2027" })).toThrow();
  });
});

describe("RoutesController", () => {
  it("months soma adultos e crianças em passageiros", async () => {
    const { controller, service } = controllerWith();
    await controller.months({ origin: "FLN", destination: "SYD", adults: 2, children: 1 });
    expect(service.monthsByRoute).toHaveBeenCalledWith(
      { originIata: "FLN", destinationIata: "SYD" },
      3
    );
  });

  it("offers repassa a rota, as datas e os passageiros", async () => {
    const { controller, service } = controllerWith();
    await controller.offers({
      origin: "FLN",
      destination: "SYD",
      depart: "2027-02-11",
      return: "2027-02-25",
      adults: 1,
      children: 0
    });
    expect(service.offersByRoute).toHaveBeenCalledWith({
      originIata: "FLN",
      destinationIata: "SYD",
      departDate: "2027-02-11",
      returnDate: "2027-02-25",
      adults: 1,
      children: 0
    });
  });

  it("offers sem volta manda returnDate undefined", async () => {
    const { controller, service } = controllerWith();
    await controller.offers({
      origin: "FLN",
      destination: "SYD",
      depart: "2027-02-11",
      adults: 1,
      children: 0
    });
    expect(service.offersByRoute.mock.calls[0]![0].returnDate).toBeUndefined();
  });

  it("devolve a seção que o serviço deu", async () => {
    const { controller } = controllerWith();
    await expect(
      controller.months({ origin: "FLN", destination: "SYD", adults: 1, children: 0 })
    ).resolves.toEqual(emptySection);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/api exec vitest run src/flights/routes.controller.spec.ts`
Expected: FAIL — `Cannot find module './routes.controller'`.

- [ ] **Step 3: Implementar o controller**

Criar `apps/api/src/flights/routes.controller.ts`:

```ts
import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import {
  isoDateSchema,
  type FlightOffer,
  type ProviderSection,
  type RouteDeal
} from "@farol/shared";
import { ZodValidationPipe } from "../common/zod.pipe";
import { FlightsService } from "./flights.service";

const iata = z.string().length(3);

// Query string chega como texto: z.coerce converte antes de validar. Sem isso
// `adults=2` reprovaria por não ser número.
export const routeMonthsQuerySchema = z.object({
  origin: iata,
  destination: iata,
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0)
});
export type RouteMonthsQuery = z.infer<typeof routeMonthsQuerySchema>;

// `return` ausente é ida só — não é um campo esquecido. O codificador do
// protobuf do Google só acrescenta a perna de volta quando ela existe.
export const routeOffersQuerySchema = routeMonthsQuerySchema.extend({
  depart: isoDateSchema,
  return: isoDateSchema.optional()
});
export type RouteOffersQuery = z.infer<typeof routeOffersQuerySchema>;

/**
 * Busca de voo por rota livre: origem e destino quaisquer, sem passar pelo
 * catálogo de destinos nem por uma viagem. É a única porta para um destino que
 * o catálogo não tem — Sydney, por exemplo.
 *
 * Fica atrás do AuthGuard global de propósito: não há rate limiting no projeto,
 * e rota aberta que consome cota de provider externo é convite.
 */
@Controller("routes")
export class RoutesController {
  constructor(private readonly flights: FlightsService) {}

  /** Melhor preço mês a mês — "quando essa rota é mais barata". */
  @Get("months")
  months(
    @Query(new ZodValidationPipe(routeMonthsQuerySchema)) query: RouteMonthsQuery
  ): Promise<ProviderSection<RouteDeal>> {
    return this.flights.monthsByRoute(
      { originIata: query.origin, destinationIata: query.destination },
      query.adults + query.children
    );
  }

  /** Ofertas reais numa data. Sem `return`, é ida só. */
  @Get("offers")
  offers(
    @Query(new ZodValidationPipe(routeOffersQuerySchema)) query: RouteOffersQuery
  ): Promise<ProviderSection<FlightOffer>> {
    return this.flights.offersByRoute({
      originIata: query.origin,
      destinationIata: query.destination,
      departDate: query.depart,
      returnDate: query.return,
      adults: query.adults,
      children: query.children
    });
  }
}
```

- [ ] **Step 4: Registrar no módulo**

Em `apps/api/src/flights/flights.module.ts`, importar `RoutesController` e acrescentá-lo à lista:

```ts
  controllers: [FlightsController, RoutesController],
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/api exec vitest run src/flights/routes.controller.spec.ts`
Expected: PASS.

- [ ] **Step 6: Escrever o e2e de API**

Criar `apps/api/test/routes.e2e-spec.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createDbClient, providerCache } from "@farol/db";
import { FLIGHT_PROVIDER } from "../src/providers/providers.module";
import { FakeFlightProvider } from "./support/fake-providers";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de routes");

let app: INestApplication;
let jwks: FakeJwks;
let auth: string;
const { db, close } = createDbClient(dbUrl);

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FLIGHT_PROVIDER)
    .useValue(new FakeFlightProvider())
    .compile();
  app = mod.createNestApplication();
  await app.init();
  auth = `Bearer ${await jwks.sign({ sub: crypto.randomUUID(), email: "rota@farol.test" })}`;
});

afterAll(async () => {
  await db.delete(providerCache);
  await close();
  await app.close();
  await jwks.stop();
});

describe("GET /routes/months", () => {
  it("responde a rota sem viagem, catálogo ou destino escolhido", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/months?origin=FLN&destination=SYD&adults=1")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
    expect(res.body.error).toBeNull();
  });

  it("exige credencial", async () => {
    const res = await request(app.getHttpServer()).get("/routes/months?origin=FLN&destination=SYD");
    expect(res.status).toBe(401);
  });

  it("recusa IATA inválido com 400", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/months?origin=FL&destination=SYD")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
  });
});

describe("GET /routes/offers", () => {
  it("busca ida e volta", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11&return=2027-02-25")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  it("busca ida só", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
  });

  it("traz os trechos da oferta com escala", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11")
      .set("Authorization", auth);
    const comEscala = res.body.offers.find((o: { stops: number }) => o.stops > 0);
    expect(comEscala.segments.length).toBe(comEscala.stops + 1);
  });

  it("exige a data de ida", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
  });
});

describe("provider fora do ar", () => {
  it("devolve seção degradada com 200, não 500", async () => {
    const mod = await Test.createTestingModule({ imports: [(await import("../src/app.module")).AppModule] })
      .overrideProvider(FLIGHT_PROVIDER)
      .useValue(new FakeFlightProvider({ fail: true }))
      .compile();
    const caido = mod.createNestApplication();
    await caido.init();
    const res = await request(caido.getHttpServer())
      .get("/routes/months?origin=FLN&destination=SYD")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ offers: [], error: "unavailable" });
    await caido.close();
  });
});
```

Conferir em `apps/api/test/flights.e2e-spec.ts` os nomes exatos de `close`, `jwks.stop()` e da opção `{ fail: true }` do `FakeFlightProvider`, e alinhar. O `providerCache` é limpo no `afterAll` porque os testes de rota compartilham a mesma chave de cache entre si.

- [ ] **Step 7: Rodar o e2e**

Run: `pnpm --filter @farol/api test:e2e`
Expected: PASS, incluindo os e2e que já existiam.

- [ ] **Step 8: Rodar o pacote inteiro com cobertura**

Run: `pnpm --filter @farol/api test`
Expected: PASS, 100%.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/flights/routes.controller.ts apps/api/src/flights/routes.controller.spec.ts \
        apps/api/src/flights/flights.module.ts apps/api/test/routes.e2e-spec.ts
git commit -m "feat(api): GET /routes/months e GET /routes/offers

Busca por rota livre: origem e destino quaisquer, sem catálogo e sem
viagem. É a única porta para um destino que o catálogo não tem.

Atrás do AuthGuard global — não há rate limiting no projeto.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: cliente HTTP do web

**Files:**
- Create: `apps/web/src/lib/route-api.ts`
- Create: `apps/web/src/lib/route-api.spec.ts`

**Interfaces:**
- Consumes: `GET /routes/months` e `GET /routes/offers` da Task 3.
- Produces:
  - `getRouteMonths(token, query: RouteMonthsInput, f?): Promise<ProviderSection<RouteDeal>>`
  - `getRouteOffers(token, query: RouteOffersInput, f?): Promise<ProviderSection<FlightOffer>>`
  - `type RouteMonthsInput = { origin: string; destination: string; adults: number; children: number }`
  - `type RouteOffersInput = RouteMonthsInput & { depart: string; return?: string }`

  A Task 5 chama esses dois.

- [ ] **Step 1: Escrever o teste, que falha**

Criar `apps/web/src/lib/route-api.spec.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { getRouteMonths, getRouteOffers } from "./route-api";

function fakeFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  }) as unknown as typeof fetch;
}

const emptySection = { offers: [], stale: false, fetchedAt: null, error: null };

describe("getRouteMonths", () => {
  it("monta a query com rota e passageiros", async () => {
    const f = fakeFetch(emptySection);
    await getRouteMonths("tok", { origin: "FLN", destination: "SYD", adults: 2, children: 1 }, f);
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain("/routes/months");
    expect(url).toContain("origin=FLN");
    expect(url).toContain("destination=SYD");
    expect(url).toContain("adults=2");
    expect(url).toContain("children=1");
  });

  it("devolve a seção validada", async () => {
    const f = fakeFetch(emptySection);
    await expect(
      getRouteMonths("tok", { origin: "FLN", destination: "SYD", adults: 1, children: 0 }, f)
    ).resolves.toEqual(emptySection);
  });
});

describe("getRouteOffers", () => {
  it("inclui a volta quando existe", async () => {
    const f = fakeFetch(emptySection);
    await getRouteOffers(
      "tok",
      { origin: "FLN", destination: "SYD", adults: 1, children: 0, depart: "2027-02-11", return: "2027-02-25" },
      f
    );
    expect(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0])).toContain(
      "return=2027-02-25"
    );
  });

  it("omite a volta na ida só — não manda o parâmetro vazio", async () => {
    const f = fakeFetch(emptySection);
    await getRouteOffers(
      "tok",
      { origin: "FLN", destination: "SYD", adults: 1, children: 0, depart: "2027-02-11" },
      f
    );
    expect(String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0])).not.toContain(
      "return="
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/web exec vitest run src/lib/route-api.spec.ts`
Expected: FAIL — `Cannot find module './route-api'`.

- [ ] **Step 3: Implementar**

Criar `apps/web/src/lib/route-api.ts`:

```ts
import {
  flightOfferSchema,
  providerSectionSchema,
  routeDealSchema,
  type FlightOffer,
  type ProviderSection,
  type RouteDeal
} from "@farol/shared";
import { apiFetch } from "./api-client";

export interface RouteMonthsInput {
  origin: string;
  destination: string;
  adults: number;
  children: number;
}

export interface RouteOffersInput extends RouteMonthsInput {
  depart: string;
  /** Ausente = ida só. */
  return?: string;
}

// URLSearchParams com um valor undefined escreveria "return=undefined" — o
// parâmetro precisa sumir, não virar texto.
function queryString(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/** Melhor preço mês a mês da rota — "quando ir". Não exige data. */
export function getRouteMonths(
  token: string,
  input: RouteMonthsInput,
  f?: typeof fetch
): Promise<ProviderSection<RouteDeal>> {
  return apiFetch(
    {
      path: `/routes/months?${queryString({ ...input })}`,
      schema: providerSectionSchema(routeDealSchema),
      token
    },
    f
  );
}

/** Ofertas reais numa data. Sem `return`, é ida só. */
export function getRouteOffers(
  token: string,
  input: RouteOffersInput,
  f?: typeof fetch
): Promise<ProviderSection<FlightOffer>> {
  return apiFetch(
    {
      path: `/routes/offers?${queryString({ ...input })}`,
      schema: providerSectionSchema(flightOfferSchema),
      token
    },
    f
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/web exec vitest run src/lib/route-api.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/route-api.ts apps/web/src/lib/route-api.spec.ts
git commit -m "feat(web): cliente das rotas de busca por rota livre

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: a tela `/rotas`

**Files:**
- Create: `apps/web/src/lib/route-form.ts`, `apps/web/src/lib/route-form.spec.ts`
- Create: `apps/web/src/components/routes/RouteForm.tsx` (+ `.spec.tsx`)
- Create: `apps/web/src/components/routes/MonthList.tsx` (+ `.spec.tsx`)
- Create: `apps/web/src/components/routes/OfferList.tsx` (+ `.spec.tsx`)
- Create: `apps/web/src/app/rotas/page.tsx`, `apps/web/src/app/rotas/rotas.css`

**Interfaces:**
- Consumes: `getRouteMonths`, `getRouteOffers`, `RouteMonthsInput`, `RouteOffersInput` da Task 4; `FlightOffer.segments` da Task 1.
- Produces:
  - `type RouteFormState = { origin: string; destination: string; tripType: "one-way" | "round-trip"; depart: string; return: string; adults: number; children: number }`
  - `emptyRouteForm(): RouteFormState`
  - `toMonthsInput(state: RouteFormState): RouteMonthsInput | null` — `null` quando a rota está incompleta
  - `toOffersInput(state: RouteFormState): RouteOffersInput | null` — `null` quando falta a data de ida, ou a de volta num ida-e-volta
  - `monthLabel(key: string): string` — `"2027-02"` → `"fevereiro de 2027"`
  - `cheapestDeal(deals: RouteDeal[]): RouteDeal | null`
  - A Task 6 usa os `data-testid` definidos aqui.

- [ ] **Step 1: Escrever o teste da lógica do formulário, que falha**

Criar `apps/web/src/lib/route-form.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  cheapestDeal,
  emptyRouteForm,
  monthLabel,
  toMonthsInput,
  toOffersInput
} from "./route-form";
import type { RouteDeal } from "@farol/shared";

const cheio = {
  ...emptyRouteForm(),
  origin: "FLN",
  destination: "SYD",
  depart: "2027-02-11",
  return: "2027-02-25",
  tripType: "round-trip" as const
};

describe("emptyRouteForm", () => {
  it("começa em ida e volta com um adulto", () => {
    const state = emptyRouteForm();
    expect(state.tripType).toBe("round-trip");
    expect(state.adults).toBe(1);
    expect(state.children).toBe(0);
  });
});

describe("toMonthsInput", () => {
  it("basta a rota — não precisa de data", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FLN", destination: "SYD" })).toEqual({
      origin: "FLN",
      destination: "SYD",
      adults: 1,
      children: 0
    });
  });

  it("é nulo sem destino", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FLN" })).toBeNull();
  });

  it("é nulo com IATA incompleto", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "FL", destination: "SYD" })).toBeNull();
  });

  it("normaliza para maiúsculas", () => {
    expect(toMonthsInput({ ...emptyRouteForm(), origin: "fln", destination: "syd" })!.origin).toBe(
      "FLN"
    );
  });
});

describe("toOffersInput", () => {
  it("ida e volta leva as duas datas", () => {
    expect(toOffersInput(cheio)).toEqual({
      origin: "FLN",
      destination: "SYD",
      adults: 1,
      children: 0,
      depart: "2027-02-11",
      return: "2027-02-25"
    });
  });

  it("ida só omite a volta mesmo se o campo tiver valor", () => {
    expect(toOffersInput({ ...cheio, tripType: "one-way" }).return).toBeUndefined();
  });

  it("é nulo sem data de ida", () => {
    expect(toOffersInput({ ...cheio, depart: "" })).toBeNull();
  });

  it("é nulo em ida e volta sem data de volta", () => {
    expect(toOffersInput({ ...cheio, return: "" })).toBeNull();
  });
});

describe("monthLabel", () => {
  it("escreve o mês por extenso", () => {
    expect(monthLabel("2027-02")).toBe("fevereiro de 2027");
  });

  it("devolve a chave crua quando não é um mês", () => {
    expect(monthLabel("SYD")).toBe("SYD");
  });
});

describe("cheapestDeal", () => {
  const deal = (key: string, price: number) => ({ key, price }) as RouteDeal;

  it("acha o menor preço", () => {
    expect(cheapestDeal([deal("2027-01", 9000), deal("2027-02", 6420)])!.key).toBe("2027-02");
  });

  it("é nulo na lista vazia", () => {
    expect(cheapestDeal([])).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/web exec vitest run src/lib/route-form.spec.ts`
Expected: FAIL — `Cannot find module './route-form'`.

- [ ] **Step 3: Implementar a lógica do formulário**

Criar `apps/web/src/lib/route-form.ts`:

```ts
import type { RouteDeal } from "@farol/shared";
import type { RouteMonthsInput, RouteOffersInput } from "./route-api";

export type TripType = "one-way" | "round-trip";

export interface RouteFormState {
  origin: string;
  destination: string;
  tripType: TripType;
  depart: string;
  return: string;
  adults: number;
  children: number;
}

export function emptyRouteForm(): RouteFormState {
  return {
    origin: "",
    destination: "",
    tripType: "round-trip",
    depart: "",
    return: "",
    adults: 1,
    children: 0
  };
}

const IATA = /^[A-Z]{3}$/;

function route(state: RouteFormState): RouteMonthsInput | null {
  const origin = state.origin.trim().toUpperCase();
  const destination = state.destination.trim().toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination)) {
    return null;
  }
  return { origin, destination, adults: state.adults, children: state.children };
}

/** O passo 1 só precisa da rota: "em que mês isso é mais barato". */
export function toMonthsInput(state: RouteFormState): RouteMonthsInput | null {
  return route(state);
}

/** O passo 2 precisa da data. Ida e volta precisa das duas. */
export function toOffersInput(state: RouteFormState): RouteOffersInput | null {
  const base = route(state);
  if (base === null || state.depart === "") {
    return null;
  }
  if (state.tripType === "one-way") {
    return { ...base, depart: state.depart };
  }
  if (state.return === "") {
    return null;
  }
  return { ...base, depart: state.depart, return: state.return };
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

// A chave do RouteDeal é o mês ("2027-02") no /v1/prices/monthly e o IATA do
// destino no /v1/city-directions. Aqui só o primeiro caso interessa; o outro
// passa cru em vez de virar "mês NaN".
export function monthLabel(key: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (match === null) {
    return key;
  }
  const month = MONTHS[Number(match[2]) - 1];
  return month === undefined ? key : `${month} de ${match[1]}`;
}

export function cheapestDeal(deals: RouteDeal[]): RouteDeal | null {
  return deals.reduce<RouteDeal | null>(
    (best, deal) => (best === null || deal.price < best.price ? deal : best),
    null
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/web exec vitest run src/lib/route-form.spec.ts`
Expected: PASS.

- [ ] **Step 5: Escrever o teste do `OfferList`, que falha**

Este é o componente que carrega a novidade da Task 1. Criar `apps/web/src/components/routes/OfferList.spec.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OfferList } from "./OfferList";
import type { FlightOffer, ProviderSection } from "@farol/shared";

const base: FlightOffer = {
  id: "gf:LA:LA755-LA800:2027-02-11:6420",
  price: 6420,
  currency: "BRL",
  carrier: "LA",
  carrierName: "LATAM",
  originIata: "FLN",
  originName: "Florianópolis",
  destinationIata: "SYD",
  destinationName: "Sydney",
  stops: 1,
  segments: [
    {
      fromIata: "FLN", fromName: "Florianópolis", toIata: "SCL", toName: "Santiago",
      departAt: "2027-02-11T06:15:00", arriveAt: "2027-02-11T10:40:00",
      durationMinutes: 265, flightNumber: "LA755"
    },
    {
      fromIata: "SCL", fromName: "Santiago", toIata: "SYD", toName: "Sydney",
      departAt: "2027-02-11T14:30:00", arriveAt: "2027-02-12T22:05:00",
      durationMinutes: 815, flightNumber: "LA800"
    }
  ],
  departAt: "2027-02-11T06:15:00",
  arriveAt: "2027-02-12T22:05:00",
  returnAt: null,
  durationMinutes: 2510,
  deepLink: "https://www.google.com/travel/flights?tfs=abc"
};

function section(offers: FlightOffer[], over: Partial<ProviderSection<FlightOffer>> = {}) {
  return { offers, stale: false, fetchedAt: null, error: null, ...over };
}

describe("OfferList", () => {
  it("mostra o caminho quando o provider informa os trechos", () => {
    render(<OfferList section={section([base])} />);
    expect(screen.getByTestId("offer-path")).toHaveTextContent("FLN → SCL → SYD");
  });

  it("cai na contagem de escalas quando não há trechos", () => {
    render(<OfferList section={section([{ ...base, segments: [] }])} />);
    expect(screen.queryByTestId("offer-path")).toBeNull();
    expect(screen.getByText("1 escala")).toBeInTheDocument();
  });

  it("escreve direto quando não há escala", () => {
    render(<OfferList section={section([{ ...base, stops: 0, segments: [] }])} />);
    expect(screen.getByText("direto")).toBeInTheDocument();
  });

  it("pluraliza as escalas", () => {
    render(<OfferList section={section([{ ...base, stops: 2, segments: [] }])} />);
    expect(screen.getByText("2 escalas")).toBeInTheDocument();
  });

  it("avisa quando o provider está fora do ar", () => {
    render(<OfferList section={section([], { error: "unavailable" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("não consegui buscar voo agora");
  });

  it("avisa quando não achou nada", () => {
    render(<OfferList section={section([])} />);
    expect(screen.getByRole("status")).toHaveTextContent("nenhum voo para essa data");
  });
});
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/web exec vitest run src/components/routes/OfferList.spec.tsx`
Expected: FAIL — `Cannot find module './OfferList'`.

- [ ] **Step 7: Implementar o `OfferList`**

Criar `apps/web/src/components/routes/OfferList.tsx`:

```tsx
import type { FlightOffer, ProviderSection } from "@farol/shared";
import { formatMoney } from "../../lib/money";

function path(offer: FlightOffer): string {
  return [offer.segments[0]!.fromIata, ...offer.segments.map((s) => s.toIata)].join(" → ");
}

function stopsLabel(stops: number): string {
  if (stops === 0) {
    return "direto";
  }
  return stops === 1 ? "1 escala" : `${stops} escalas`;
}

function duration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

export function OfferList({ section }: { section: ProviderSection<FlightOffer> }) {
  if (section.error !== null) {
    return (
      <p className="rotas__aviso" role="status">
        não consegui buscar voo agora — o provider não respondeu
      </p>
    );
  }
  if (section.offers.length === 0) {
    return (
      <p className="rotas__aviso" role="status">
        nenhum voo para essa data
      </p>
    );
  }
  return (
    <ul className="rotas__ofertas" data-testid="offer-list">
      {section.offers.map((offer) => (
        <li key={offer.id} className="rotas__oferta">
          <strong className="rotas__preco">{formatMoney(offer.price, offer.currency)}</strong>
          <span className="rotas__cia">{offer.carrierName ?? offer.carrier}</span>
          {/* O caminho só existe quando o provider entrega os trechos. Sem
              eles, a contagem de escalas é tudo que se sabe — e é o que se
              mostra, em vez de um caminho inventado. */}
          {offer.segments.length > 0 ? (
            <span className="rotas__caminho" data-testid="offer-path">
              {path(offer)}
            </span>
          ) : (
            <span className="rotas__caminho">{stopsLabel(offer.stops)}</span>
          )}
          <span className="rotas__duracao">{duration(offer.durationMinutes)}</span>
          <a className="rotas__link" href={offer.deepLink} target="_blank" rel="noreferrer">
            ver no buscador
          </a>
        </li>
      ))}
    </ul>
  );
}
```

Conferir a assinatura real de `formatMoney` em `apps/web/src/lib/money.ts` e alinhar a chamada.

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/web exec vitest run src/components/routes/OfferList.spec.tsx`
Expected: PASS.

- [ ] **Step 9: Escrever o teste do `MonthList`, que falha**

Criar `apps/web/src/components/routes/MonthList.spec.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonthList } from "./MonthList";
import type { RouteDeal, ProviderSection } from "@farol/shared";

const deal = (key: string, price: number, departAt: string): RouteDeal => ({
  key, origin: "FLN", destination: "SYD", airline: "LA", departAt, returnAt: null,
  price, currency: "BRL", flightNumber: "800", transfers: 1,
  deepLink: "https://www.aviasales.com/search"
});

function section(offers: RouteDeal[], over: Partial<ProviderSection<RouteDeal>> = {}) {
  return { offers, stale: false, fetchedAt: null, error: null, ...over };
}

describe("MonthList", () => {
  const deals = [deal("2027-01", 9000, "2027-01-08T06:00:00"), deal("2027-02", 6420, "2027-02-11T06:15:00")];

  it("escreve os meses por extenso", () => {
    render(<MonthList section={section(deals)} onPick={vi.fn()} />);
    expect(screen.getByText("fevereiro de 2027")).toBeInTheDocument();
  });

  it("marca o mais barato", () => {
    render(<MonthList section={section(deals)} onPick={vi.fn()} />);
    expect(screen.getByTestId("cheapest-month")).toHaveTextContent("fevereiro de 2027");
  });

  it("clicar num mês devolve a data daquele achado", async () => {
    const onPick = vi.fn();
    render(<MonthList section={section(deals)} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /fevereiro de 2027/ }));
    expect(onPick).toHaveBeenCalledWith("2027-02-11");
  });

  it("diz que não há histórico em vez de fingir erro", () => {
    render(<MonthList section={section([])} onPick={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("sem histórico de preço para essa rota");
  });

  it("avisa quando o provider caiu", () => {
    render(<MonthList section={section([], { error: "unavailable" })} onPick={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("não consegui consultar os meses agora");
  });
});
```

- [ ] **Step 10: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/web exec vitest run src/components/routes/MonthList.spec.tsx`
Expected: FAIL — `Cannot find module './MonthList'`.

- [ ] **Step 11: Implementar o `MonthList`**

Criar `apps/web/src/components/routes/MonthList.tsx`:

```tsx
import type { ProviderSection, RouteDeal } from "@farol/shared";
import { cheapestDeal, monthLabel } from "../../lib/route-form";
import { formatMoney } from "../../lib/money";

export function MonthList({
  section,
  onPick
}: {
  section: ProviderSection<RouteDeal>;
  onPick: (departDate: string) => void;
}) {
  if (section.error !== null) {
    return (
      <p className="rotas__aviso" role="status">
        não consegui consultar os meses agora — o provider não respondeu
      </p>
    );
  }
  // Vazio aqui não é falha: o /v1/prices/monthly serve cache do parceiro, e uma
  // rota que quase ninguém pesquisa simplesmente não tem linha. Dizer isso é
  // mais honesto do que trocar a rota da pessoa por um hub sem avisar.
  if (section.offers.length === 0) {
    return (
      <p className="rotas__aviso" role="status">
        sem histórico de preço para essa rota — escolha uma data e busque direto
      </p>
    );
  }
  const cheapest = cheapestDeal(section.offers);
  return (
    <ul className="rotas__meses" data-testid="month-list">
      {section.offers.map((deal) => {
        const isCheapest = cheapest !== null && deal.key === cheapest.key;
        return (
          <li key={deal.key}>
            <button
              type="button"
              className={isCheapest ? "rotas__mes rotas__mes--barato" : "rotas__mes"}
              data-testid={isCheapest ? "cheapest-month" : undefined}
              onClick={() => onPick(deal.departAt.slice(0, 10))}
            >
              <span className="rotas__mes-nome">{monthLabel(deal.key)}</span>
              <span className="rotas__mes-preco">{formatMoney(deal.price, deal.currency)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 12: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/web exec vitest run src/components/routes/MonthList.spec.tsx`
Expected: PASS.

- [ ] **Step 13: Escrever o teste do `RouteForm`, que falha**

Criar `apps/web/src/components/routes/RouteForm.spec.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteForm } from "./RouteForm";
import { emptyRouteForm } from "../../lib/route-form";

describe("RouteForm", () => {
  it("devolve o estado ao mudar um campo", async () => {
    const onChange = vi.fn();
    render(<RouteForm state={emptyRouteForm()} onChange={onChange} onSubmit={vi.fn()} pending={false} />);
    await userEvent.type(screen.getByLabelText("Origem"), "FLN");
    expect(onChange).toHaveBeenCalled();
  });

  it("esconde a data de volta na ida só", () => {
    render(
      <RouteForm
        state={{ ...emptyRouteForm(), tripType: "one-way" }}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        pending={false}
      />
    );
    expect(screen.queryByLabelText("Volta")).toBeNull();
  });

  it("mostra a data de volta na ida e volta", () => {
    render(<RouteForm state={emptyRouteForm()} onChange={vi.fn()} onSubmit={vi.fn()} pending={false} />);
    expect(screen.getByLabelText("Volta")).toBeInTheDocument();
  });

  it("submete sem recarregar a página", async () => {
    const onSubmit = vi.fn();
    render(
      <RouteForm
        state={{ ...emptyRouteForm(), origin: "FLN", destination: "SYD" }}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        pending={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("desabilita o botão enquanto busca", () => {
    render(<RouteForm state={emptyRouteForm()} onChange={vi.fn()} onSubmit={vi.fn()} pending />);
    expect(screen.getByRole("button", { name: "Buscando…" })).toBeDisabled();
  });
});
```

- [ ] **Step 14: Rodar e confirmar que falha**

Run: `pnpm --filter @farol/web exec vitest run src/components/routes/RouteForm.spec.tsx`
Expected: FAIL — `Cannot find module './RouteForm'`.

- [ ] **Step 15: Implementar o `RouteForm`**

Criar `apps/web/src/components/routes/RouteForm.tsx`:

```tsx
"use client";

import type { RouteFormState, TripType } from "../../lib/route-form";

export function RouteForm({
  state,
  onChange,
  onSubmit,
  pending
}: {
  state: RouteFormState;
  onChange: (next: RouteFormState) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const set = <K extends keyof RouteFormState>(key: K, value: RouteFormState[K]) =>
    onChange({ ...state, [key]: value });

  return (
    <form
      className="rotas__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="rotas__campo">
        Origem
        <input
          value={state.origin}
          onChange={(e) => set("origin", e.target.value)}
          placeholder="FLN"
          maxLength={3}
        />
      </label>

      <label className="rotas__campo">
        Destino
        <input
          value={state.destination}
          onChange={(e) => set("destination", e.target.value)}
          placeholder="SYD"
          maxLength={3}
        />
      </label>

      <label className="rotas__campo">
        Viagem
        <select
          value={state.tripType}
          onChange={(e) => set("tripType", e.target.value as TripType)}
        >
          <option value="round-trip">Ida e volta</option>
          <option value="one-way">Só ida</option>
        </select>
      </label>

      <label className="rotas__campo">
        Ida
        <input type="date" value={state.depart} onChange={(e) => set("depart", e.target.value)} />
      </label>

      {state.tripType === "round-trip" ? (
        <label className="rotas__campo">
          Volta
          <input type="date" value={state.return} onChange={(e) => set("return", e.target.value)} />
        </label>
      ) : null}

      <label className="rotas__campo">
        Adultos
        <input
          type="number"
          min={1}
          value={state.adults}
          onChange={(e) => set("adults", Number(e.target.value))}
        />
      </label>

      <button type="submit" className="rotas__buscar" disabled={pending}>
        {pending ? "Buscando…" : "Buscar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 16: Rodar e confirmar que passa**

Run: `pnpm --filter @farol/web exec vitest run src/components/routes/RouteForm.spec.tsx`
Expected: PASS.

- [ ] **Step 17: Montar a página**

Criar `apps/web/src/app/rotas/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import "./rotas.css";
import type { FlightOffer, ProviderSection, RouteDeal } from "@farol/shared";
import { AuthGate } from "../../components/AuthGate";
import { BrandHeader } from "../../components/common/BrandHeader";
import { MonthList } from "../../components/routes/MonthList";
import { OfferList } from "../../components/routes/OfferList";
import { RouteForm } from "../../components/routes/RouteForm";
import { getRouteMonths, getRouteOffers } from "../../lib/route-api";
import { emptyRouteForm, toMonthsInput, toOffersInput, type RouteFormState } from "../../lib/route-form";

function Rotas({ token }: { token: string }) {
  const [state, setState] = useState<RouteFormState>(emptyRouteForm());
  const [months, setMonths] = useState<ProviderSection<RouteDeal> | null>(null);
  const [offers, setOffers] = useState<ProviderSection<FlightOffer> | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Passo 1 e passo 2 numa submissão só: os meses só precisam da rota, e as
  // ofertas só saem se já houver data. Sem data, a tela para no passo 1 e a
  // pessoa escolhe um mês — que preenche a data e dispara o passo 2.
  async function submit(next: RouteFormState = state) {
    const monthsInput = toMonthsInput(next);
    if (monthsInput === null) {
      setError("informe origem e destino com três letras (FLN, SYD)");
      return;
    }
    setPending(true);
    setError(null);
    try {
      setMonths(await getRouteMonths(token, monthsInput));
      const offersInput = toOffersInput(next);
      setOffers(offersInput === null ? null : await getRouteOffers(token, offersInput));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "não consegui buscar essa rota");
    } finally {
      setPending(false);
    }
  }

  function pickMonth(departDate: string) {
    const next = { ...state, depart: departDate };
    setState(next);
    void submit(next);
  }

  return (
    <main className="screen">
      <BrandHeader href="/trips">
        <span className="screen__badge">Busca por rota</span>
        <Link className="screen__back" href="/trips">
          ← Minhas viagens
        </Link>
      </BrandHeader>

      <div className="screen__card">
        <h1 className="screen__title">Quanto custa ir de A a B.</h1>
        <p className="screen__sub">
          Origem e destino quaisquer, pelo código do aeroporto. Sem data, eu mostro em que mês a
          rota sai mais barata; com data, os voos daquele dia.
        </p>

        <RouteForm
          state={state}
          onChange={setState}
          onSubmit={() => void submit()}
          pending={pending}
        />

        {error !== null ? (
          <p className="screen__error" role="alert">
            {error}
          </p>
        ) : null}

        {months !== null ? (
          <section className="rotas__secao">
            <h2>Quando ir</h2>
            <MonthList section={months} onPick={pickMonth} />
          </section>
        ) : null}

        {offers !== null ? (
          <section className="rotas__secao">
            <h2>Voos</h2>
            <OfferList section={offers} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function RotasPage() {
  return <AuthGate>{(token) => <Rotas token={token} />}</AuthGate>;
}
```

Criar `apps/web/src/app/rotas/rotas.css` seguindo os tokens que `apps/web/src/app/auto/auto.css` já usa — mesmas variáveis de cor e espaçamento, sem valores literais novos.

- [ ] **Step 18: Rodar o pacote inteiro com cobertura**

Run: `pnpm --filter @farol/web test`
Expected: PASS, 100%. Se a página ficar descoberta, acrescentar um `page.spec.tsx` que renderiza `Rotas` com um token falso e cobre os três caminhos: erro de validação, sucesso com data e sucesso sem data.

- [ ] **Step 19: Commit**

```bash
git add apps/web/src/lib/route-form.ts apps/web/src/lib/route-form.spec.ts \
        apps/web/src/components/routes apps/web/src/app/rotas
git commit -m "feat(web): tela /rotas — busca por rota livre

Dois passos numa tela: em que mês a rota é mais barata, e os voos da data
escolhida com o caminho de cada oferta.

Rota sem histórico diz que não tem histórico — não troca por um hub.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Playwright do fluxo

**Files:**
- Create: `apps/web/e2e/routes.spec.ts`

**Interfaces:**
- Consumes: os `data-testid` da Task 5 (`month-list`, `cheapest-month`, `offer-list`, `offer-path`) e as rotas da Task 3.

- [ ] **Step 1: Escrever o teste**

Criar `apps/web/e2e/routes.spec.ts`. Abrir `apps/web/e2e/booking.spec.ts` primeiro e copiar dali o helper de sessão autenticada e o padrão de `page.route(...)` para interceptar a api — o arquivo novo usa exatamente o mesmo mecanismo.

```ts
import { test, expect } from "@playwright/test";

const MONTHS = {
  offers: [
    {
      key: "2027-01", origin: "FLN", destination: "SYD", airline: "LA",
      departAt: "2027-01-08T06:00:00", returnAt: null, price: 9000, currency: "BRL",
      flightNumber: "800", transfers: 1, deepLink: "https://www.aviasales.com/search"
    },
    {
      key: "2027-02", origin: "FLN", destination: "SYD", airline: "LA",
      departAt: "2027-02-11T06:15:00", returnAt: null, price: 6420, currency: "BRL",
      flightNumber: "800", transfers: 1, deepLink: "https://www.aviasales.com/search"
    }
  ],
  stale: false, fetchedAt: null, error: null
};

const OFFERS = {
  offers: [
    {
      id: "gf:LA:LA755-LA800:2027-02-11:6420", price: 6420, currency: "BRL",
      carrier: "LA", carrierName: "LATAM",
      originIata: "FLN", originName: "Florianópolis",
      destinationIata: "SYD", destinationName: "Sydney",
      stops: 1,
      segments: [
        { fromIata: "FLN", fromName: "Florianópolis", toIata: "SCL", toName: "Santiago",
          departAt: "2027-02-11T06:15:00", arriveAt: "2027-02-11T10:40:00",
          durationMinutes: 265, flightNumber: "LA755" },
        { fromIata: "SCL", fromName: "Santiago", toIata: "SYD", toName: "Sydney",
          departAt: "2027-02-11T14:30:00", arriveAt: "2027-02-12T22:05:00",
          durationMinutes: 815, flightNumber: "LA800" }
      ],
      departAt: "2027-02-11T06:15:00", arriveAt: "2027-02-12T22:05:00",
      returnAt: null, durationMinutes: 2510,
      deepLink: "https://www.google.com/travel/flights?tfs=abc"
    }
  ],
  stale: false, fetchedAt: null, error: null
};

test.describe("busca por rota", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/routes/months*", (route) =>
      route.fulfill({ json: MONTHS })
    );
    await page.route("**/routes/offers*", (route) =>
      route.fulfill({ json: OFFERS })
    );
  });

  test("mês mais barato leva às ofertas, com o caminho visível", async ({ page }) => {
    await page.goto("/rotas");

    await page.getByLabel("Origem").fill("FLN");
    await page.getByLabel("Destino").fill("SYD");
    await page.getByLabel("Viagem").selectOption("one-way");
    await page.getByRole("button", { name: "Buscar" }).click();

    await expect(page.getByTestId("month-list")).toBeVisible();
    await expect(page.getByTestId("cheapest-month")).toContainText("fevereiro de 2027");

    await page.getByTestId("cheapest-month").click();

    await expect(page.getByTestId("offer-list")).toBeVisible();
    await expect(page.getByTestId("offer-path")).toHaveText("FLN → SCL → SYD");
  });

  test("rota sem histórico diz que não tem histórico", async ({ page }) => {
    await page.route("**/routes/months*", (route) =>
      route.fulfill({ json: { offers: [], stale: false, fetchedAt: null, error: null } })
    );
    await page.goto("/rotas");
    await page.getByLabel("Origem").fill("XAP");
    await page.getByLabel("Destino").fill("SYD");
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByRole("status")).toContainText("sem histórico de preço para essa rota");
  });
});
```

O `beforeEach` precisa da sessão autenticada — sem ela o `AuthGate` redireciona para `/login`. Usar o mesmo helper de `booking.spec.ts`.

- [ ] **Step 2: Rodar**

Run: `pnpm --filter @farol/web test:e2e -- routes.spec.ts`
Expected: PASS.

- [ ] **Step 3: Rodar tudo**

Run: `pnpm test && pnpm test:e2e`
Expected: PASS, todos os gates de cobertura verdes.

- [ ] **Step 4: Rodar mutação nos pacotes tocados**

Run: `pnpm --filter @farol/shared test:mutation && pnpm --filter @farol/api test:mutation`
Expected: score ≥ 90 nos dois. Mutante sobrevivente = escrever o teste que o mata, ou justificar no PR.

- [ ] **Step 5: Commit e PR**

```bash
git add apps/web/e2e/routes.spec.ts
git commit -m "test(web): e2e da busca por rota

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -u origin rafaignaulin/busca-por-rota
gh pr create --title "Busca por rota — origem e destino livres" --body "$(cat <<'BODY'
Implementa `docs/superpowers/specs/2026-09-09-busca-por-rota-design.md`.

Duas rotas HTTP que respondem "em que mês essa rota é mais barata" e
"quais os voos reais nessa data" para um par origem-destino qualquer,
sem passar pelo catálogo de destinos. É a única porta para um destino
que o catálogo não tem.

- `segments[]` na oferta: o `readOffer` já parseava cada trecho e
  descartava tudo em `stops`. Agora dá para distinguir via Santiago de
  via Doha.
- `routeSection` sem viagem, e os métodos por-viagem delegando.
- `GET /routes/months` e `GET /routes/offers`, atrás do guard global.
- Tela `/rotas`.

Fora do escopo, e por quê, na seção "O que fica de fora" da spec.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## Self-Review

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| `GET /routes/months` | 3 |
| `GET /routes/offers`, `return` ausente = ida só | 3 |
| Atrás do `AuthGuard` global, sem `@Public()` | 3 (e2e prova o 401) |
| `segments[]` com `.default([])` | 1 |
| `readOffer` publica os trechos | 1 |
| `routeSection` sem viagem, métodos por-viagem delegando | 2 |
| Controller no `FlightsModule`, sem módulo/tabela/migration novos | 3 |
| Página `/rotas` com os dois blocos | 5 |
| Mês mais barato preenche a data e dispara o passo 2 | 5 (`pickMonth`) |
| Vazio ≠ erro; sem fallback automático para hub | 5 (`MonthList`), testado em 5 e 6 |
| `segments` vazio degrada para contagem de escalas | 1, 5 (`OfferList`) |
| Cobertura 100% + mutação ≥ 90 | 1, 3, 5, 6 |
| Testes de unidade, contrato, e2e de API e Playwright | 1, 2, 3, 5, 6 |

Nenhum requisito da spec ficou sem tarefa.

**Consistência de nomes:** `monthsByRoute` e `offersByRoute` são definidos na Task 2 e chamados com a mesma assinatura na Task 3. `getRouteMonths`/`getRouteOffers` são definidos na Task 4 e chamados na Task 5. `RouteMonthsInput`/`RouteOffersInput` atravessam as Tasks 4 e 5. Os `data-testid` (`month-list`, `cheapest-month`, `offer-list`, `offer-path`) são criados na Task 5 e usados na Task 6.

**Pontos a conferir contra o código na hora de executar** (o plano diz onde olhar, não inventa a resposta): o nome do helper de construção de serviço em `flights.service.spec.ts`; a assinatura de `formatMoney` em `lib/money.ts`; os nomes de `close`/`jwks.stop()` e da opção `{ fail: true }` do `FakeFlightProvider` em `flights.e2e-spec.ts`; o helper de sessão autenticada em `e2e/booking.spec.ts`; e o nome das variáveis `payload`/`ctx` no `describe` existente de `normalize-flight.spec.ts`.
