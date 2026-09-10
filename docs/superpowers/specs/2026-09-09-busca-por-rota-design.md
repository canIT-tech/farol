# Busca por rota — origem e destino livres

**Data:** 2026-09-09 · **Status:** proposto · **Branch:** `rafaignaulin/busca-por-rota`

## O problema

Não dá para perguntar ao Farol quanto custa um voo para um lugar que não está no
catálogo. Toda busca de voo pende de uma viagem com destino escolhido:

```ts
// apps/api/src/providers/trip-search.ts:22
export function chosenIata(trip: TripState): string {
  const iata = trip.chosenDestination?.iata;
  if (iata === undefined) {
    throw new DomainError("no_destination_chosen", "escolha um destino antes de buscar voo ou hotel");
  }
  return iata;
}
```

E `chosenDestination` só é preenchido pela descoberta, a partir das linhas de
`trip_destinations` que saem do catálogo (`apps/api/src/trips/trip-state.ts:56`).
O catálogo tem 23 cidades (`packages/db/data/destinations.csv`), a mais distante
é Cidade do Cabo. Sydney não está lá — então a viagem não pode nem ser criada, e
os recortes de preço que a `FlightsService` já sabe fazer ficam inalcançáveis.

A origem, por outro lado, já é livre: `trips.originIata` é uma string IATA
qualquer, não validada contra o catálogo. Só o destino está preso.

## O que já existe e está sem uso

O motor já é de rota. Três dos cinco métodos do provider não sabem o que é uma
viagem:

```ts
// packages/providers/src/flight-provider.ts:15
export interface RouteQuery {
  originIata: string;
  destinationIata: string;
}
// :32-34
priceCalendar(query: RouteQuery, passengers?: number): Promise<RoutePriceSample[]>;
latestPrices(query: LatestPricesQuery, passengers?: number): Promise<RoutePriceSample[]>;
monthlyPrices(query: RouteQuery, passengers?: number): Promise<RouteDeal[]>;
```

O `FlightsService.routeSection()` recebe uma viagem, resolve, e joga tudo fora
para ficar com esses dois campos mais a contagem de passageiros. A viagem é
cerimônia em volta de um motor que já faz o que se quer.

Duas coisas caem no colo por causa disso:

- **Cache.** `cacheKey()` é `sha256(provider|endpoint|params ordenados)` —
  sem `tripId`, sem `userId` (`apps/api/src/providers/provider-cache.repository.ts:8`).
  Busca de rota compartilha cache entre usuários sem uma linha nova.
- **Degradação.** `degradeSection()` converte qualquer falha em
  `{ offers: [], error: "unavailable" }` e mantém a página de pé
  (`apps/api/src/providers/provider-section.ts:18`).

E ida-só já está pronto no provider primário: o codificador do protobuf do Google
só acrescenta a perna de volta quando ela existe.

```ts
// packages/providers/src/googleflights/query.ts:16
if (params.returnDate !== undefined) {
  legs.push({ date: params.returnDate, fromIata: params.destinationIata, toIata: params.originIata });
}
```

## Escopo

Uma tela e duas rotas HTTP que respondem, para um par origem-destino qualquer:
**em que mês essa rota é mais barata** e **quais são os voos reais numa data**.

```
GET /routes/months?origin=FLN&destination=SYD&adults=1&children=0
    → ProviderSection<RouteDeal>

GET /routes/offers?origin=FLN&destination=SYD&depart=2027-02-11&return=2027-02-25&adults=1&children=0
    → ProviderSection<FlightOffer>
```

`return` ausente significa ida só.

Os dois passos se ligam sem um terceiro endpoint: `RouteDeal` já traz um
`departAt` concreto junto da chave do mês
(`packages/shared/src/flight-insights.ts:26`), então clicar no mês mais barato
preenche a data e dispara a segunda chamada. Não é preciso calendário dia-a-dia
para sair do passo 1 para o passo 2.

Ambas ficam atrás do `AuthGuard` global. Sem `@Public()`: não há rate limiting no
projeto, e rota aberta que consome cota de provider externo é convite.

## Desenho

### `segments[]` no `FlightOffer`

O caminho do voo é lido do payload do Google e descartado na última linha. O
`readLeg` monta cada trecho inteiro — códigos, nomes, partida, chegada, duração,
número do voo (`packages/providers/src/googleflights/normalize-flight.ts:114`) —
e o `readOffer` colapsa a lista:

```ts
// normalize-flight.ts:150
const legs = rawLegs.map(readLeg);
const first = legs[0]!;
const last = legs[legs.length - 1]!;
...
originIata: first.fromCode,
destinationIata: last.toCode,
stops: legs.length - 1,
```

FLN-SCL-SYD e FLN-GRU-DOH-SYD chegam parseados e viram "2 escalas" e "3 escalas".
Numa rota longa, saber por onde se passa é metade da decisão: quatro horas em
Santiago e quarenta e uma horas via Doha não são a mesma viagem pelo mesmo preço.

`flightOfferSchema` (`packages/shared/src/flights.ts:22`) ganha:

```ts
segments: z.array(z.object({
  fromIata: z.string().length(3),
  fromName: z.string().min(1).nullable(),
  toIata: z.string().length(3),
  toName: z.string().min(1).nullable(),
  departAt: z.string().min(1),
  arriveAt: z.string().min(1),
  durationMinutes: z.number().int().min(0),
  flightNumber: z.string().min(1).nullable()
})).default([])
```

`.default([])` porque o Travelpayouts não tem trecho — devolve `transfers: number`
e nada mais. Lista vazia quer dizer "não sei o caminho", e a tela cai na contagem
de escalas. É o mesmo acordo já usado em `carrierName: null` → a UI mostra o
código cru, nunca um nome inventado.

Nenhum código de parsing novo: o `Leg` interno já é exatamente essa forma.

### `routeSection` sem viagem

```ts
// hoje
private async routeSection<T>(userId, tripId, endpoint, call)

// depois
private routeSection<T>(query: RouteQuery, passengers: number, endpoint: string, call)
```

Os métodos por-viagem (`priceCalendar`, `latestPrices`, `monthlyPrices`) passam a
resolver a viagem e delegar. O refactor tira duplicação em vez de somar: hoje cada
um repete a mesma sequência de resolver viagem, montar params e reduzir a
`RouteQuery`.

### Superfície e web

`apps/api/src/flights/routes.controller.ts`, registrado no `FlightsModule` que já
existe. Nenhum módulo novo, nenhuma tabela nova, nenhuma migration.

No web, uma página `/rotas`: formulário (origem, destino, ida-só ou ida e volta,
passageiros) e dois blocos de resultado — os meses, com o mais barato destacado; e
as ofertas da data, cada uma mostrando o caminho.

## O que fica de fora

Nomeado para não voltar de fininho:

- **Contexto de preço** ("está caro comprar hoje"). O `searchWithContext()` existe
  no `GoogleFlightsProvider` e devolve `FlightPriceContext` com série histórica,
  mas não está na interface `FlightInsightsProvider` e o que é injetado é o
  `FallbackFlightProvider`. Exige um type-guard e repasse no fallback. É a
  primeira coisa a entrar depois.
- **Calendário dia-a-dia** e **faixa de preço recente** (`/calendar`, `/latest`).
  Já existem por viagem; ficam por viagem.
- **Aeroportos vizinhos** (`/nearby`).
- **Origem múltipla numa busca só** (FLN ou POA ou CWB → SYD). O `encodeLeg` manda
  um IATA por perna (`packages/providers/src/googleflights/tfs.ts:90`). O Google
  aceita vários, mas não está determinado se o repetido é o campo 13 ou o campo 2
  dentro dele — chutar produz busca silenciosamente errada. Precisa de um spike
  contra o endpoint real antes de virar spec.
- **Bilhetes separados** (FLN→GRU numa passagem, GRU→SYD noutra). Nenhum buscador
  combina isso, e é o que mais economiza saindo de aeroporto pequeno — mas são
  duas buscas cruzadas, uma regra de tempo mínimo de conexão e um aviso de risco
  que precisa ser levado a sério: entre bilhetes não há proteção, perdeu a
  conexão, perdeu o dinheiro. Sub-projeto próprio.
- **Stopover de vários dias** (multi-city). O `TfsQuery.legs` já é um array, mas
  hoje o Farol emite no máximo duas pernas (`tfs.ts:23`).
- **Milhas.** Sub-projeto próprio, e depende deste: sem o preço em dinheiro não há
  denominador para decidir se o resgate vale a pena.
- **Catálogo, roteiro, hotel.** A busca por rota é uma ilha. A ligação com a
  viagem, quando vier, é um link para `/rotas` já preenchido — não um subsistema.

## Riscos

**O passo 1 pode voltar vazio sem erro nenhum.** `/v1/prices/monthly` serve cache
do parceiro Aviasales: são preços que alguém viu, não uma busca ao vivo. Uma rota
que quase ninguém pesquisa pode simplesmente não ter linha. Isso não é falha do
provider e não deve ser mostrado como tal.

Comportamento: seção vazia, mensagem dizendo que não há histórico para aquela
rota, e o passo 2 segue utilizável com uma data digitada — o Google Flights é
leitura ao vivo e responde mesmo sem histórico.

**Sem fallback automático para hub.** É tentador, quando FLN→SYD volta vazio,
buscar GRU→SYD e mostrar aquilo. Trocar a rota da pessoa sem avisar faz o número
da tela não bater com o que ela encontra na hora de comprar — o mesmo motivo pelo
qual o deep link de uma oferta do Google aponta para o próprio Google, e não para
o afiliado.

**O provider primário é scraping.** Vale aqui o que já vale hoje: o
`FallbackFlightProvider` cai no Travelpayouts quando o layout muda, e o noturno
`nightly-google-flights.yml` é o que prova que a busca real ainda funciona.
`segments[]` some no fallback (lista vazia), a tela degrada para a contagem de
escalas, e nada quebra.

## Testes

Baseline do projeto: 100% de cobertura e mutação ≥ 90 por pacote.

- **Unidade** — `routeSection` sem viagem; os dois métodos novos da
  `FlightsService`; o `readOffer` preenchendo `segments[]`; o parse do
  `flightOfferSchema` com e sem `segments`.
- **Contrato** — `normalizeOffers` contra as fixtures já gravadas em
  `packages/providers/src/googleflights/__fixtures__`, verificando que os hubs
  intermediários aparecem nos segmentos.
- **E2E de API** — as duas rotas: com e sem `return`, parâmetro faltando (400 pelo
  `ZodValidationPipe`), sem credencial (401 pelo guard global), e provider fora do
  ar (seção degradada, 200).
- **Playwright** — `/rotas`: preencher, ver os meses, clicar no mais barato, ver as
  ofertas com o caminho.

O fake determinístico de provider já existe nos testes de integração e é reusado.
