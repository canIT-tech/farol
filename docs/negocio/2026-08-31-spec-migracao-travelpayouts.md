# Spec de migração — provider de voo/hotel: Amadeus → Travelpayouts

- **Status:** rascunho para implementação (revisar antes de abrir PR)
- **Data:** 2026-08-31
- **Dono (produto):** felippe · **Implementação (tech):** rafinha
- **Substitui:** o provider do Passo 5 (`docs/superpowers/plans/2026-08-28-providers-amadeus.md`)
- **Não afeta:** Passo 6 (Google Places + enrich) — provider separado, continua igual

---

## 1. Por que migrar

**A Amadeus descontinuou o portal Self-Service.** Chaves desativadas, portal fora do ar;
só o **Amadeus Enterprise** (contrato pago, setup + mensalidade + fee por reserva) segue.
Startup pré-lançamento não entra.

**Alternativas analisadas (2026):**

| Provider | Situação | Veredito |
|---|---|---|
| Sabre / Travelport | contrato GDS, custo mensal alto, você paga pra consumir (sem afiliado) | ❌ mesma armadilha do Enterprise |
| Kiwi.com Tequila | self-serve fechado em mai/2024, novas parcerias **por convite** | ⚠️ sem entrada a frio; via Travelpayouts ou reaplicar com tração |
| Skyscanner Partners | aprovação + revisão comercial, sem sandbox público, aprova quem tem escala | ⚠️ modelo certo (comissão), timing errado — **alvo de graduação pós-lançamento** |
| Duffel | self-serve, oferta real-time, mas **paga por reserva**, sem afiliado | ⚠️ melhor p/ v1 quando o Farol fizer reserva no app |
| **Travelpayouts** (Aviasales + Hotellook) | **self-serve, grátis, comissão de afiliado**, voo + hotel, forte no Brasil, carrega inventário Aviasales + Kiwi | ✅ **escolhido para o MVP** |

**Ganho colateral:** o MVP passa a ter **receita de afiliado em voo e hotel desde já**.
O design técnico dizia "afiliado fora do MVP" (D10) porque Amadeus é data-only. Com o
`marker` do Travelpayouts em cada deep-link, a comissão passa a existir no MVP, e a
pendência "site parceiro para o deep-link" deixa de existir (o parceiro é
Aviasales / Hotellook).

**Trade-off aceito:** o Travelpayouts Data API entrega **preço cacheado/agregado**, não
busca live. A busca em tempo real (Aviasales Search API) é liberada só a partir de
50 k MAU. No MVP: mostrar o preço aproximado + deep-link que cai na busca live do
parceiro, com aviso de "preço aproximado, confirme no parceiro" na UI.

---

## 2. O que fica e o que muda

### Fica (arquitetura do Passo 5 — não reescrever)

- Interfaces `FlightProvider` / `HotelProvider` em `packages/providers`.
- `provider_cache` — chave = hash(provider + endpoint + params), TTL curto.
- Cliente HTTP resiliente: `p-retry` (429 / 5xx) + circuit breaker.
- `FlightsModule` / `HotelsModule` no `apps/api`; `flight_selections` / `hotel_selections`
  com snapshot cru da oferta (`offer` jsonb) + `deep_link`.
- Degradação graciosa: falha de provider isola a seção (voo ou hotel), roteiro segue.
- Testes contra fixtures em `__fixtures__`, **sem rede no CI**; `fetchImpl` injetável.
- Envs `FLIGHT_DEEPLINK_TEMPLATE` / `HOTEL_DEEPLINK_TEMPLATE`.

### Muda

| Antes (Amadeus) | Depois (Travelpayouts) |
|---|---|
| `AmadeusFlightProvider` | `TravelpayoutsFlightProvider` |
| `AmadeusHotelProvider` | `TravelpayoutsHotelProvider` |
| `AmadeusAuth` — OAuth2 client-credentials, token em cache | **sem OAuth** — `token` no header `X-Access-Token` (ou query `token=`), `marker` no link. Apagar `amadeus/amadeus-auth.ts` |
| `packages/providers/src/amadeus/**` | `packages/providers/src/travelpayouts/**` |
| fixtures `amadeus/__fixtures__/*.json` | `travelpayouts/__fixtures__/*.json` — regravadas da API real |
| `HealthModule`: check "Amadeus token" | ping leve ao Travelpayouts (ou remover — não há handshake de auth) |
| envs `AMADEUS_BASE_URL` / `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER`, `TRAVELPAYOUTS_BASE_URL`, `HOTELLOOK_BASE_URL` |
| `provider_cache.provider` = `amadeus_flight` / `amadeus_hotel` | `travelpayouts_flight` / `travelpayouts_hotel` (ver §4) |

---

## 3. Endpoints Travelpayouts

> **Confirmar na doc ao ativar a conta** — nomes de params variam e alguns endpoints
> (o real-time) são liberados por request. O que está aqui é o caminho do MVP.

### Voo — Travelpayouts Data API (Aviasales)

- **Preços por rota e data:** `GET /aviasales/v3/prices_for_dates`
  params: `origin`, `destination` (IATA), `departure_at`, `return_at` (YYYY-MM ou YYYY-MM-DD),
  `currency=brl`, `sorting=price`, `limit`, `token`.
  Retorna: `price`, `airline`, `flight_number`, `departure_at`, `duration`,
  `transfers` (nº de escalas), `link` (caminho relativo do Aviasales).
- **Calendário de preços:** `GET /v1/prices/calendar` — para "melhor data no mês".
- **Autocomplete / IATA:** `GET https://autocomplete.travelpayouts.com/places2?term=<q>&locale=pt&types[]=city`
  ou o dump estático `GET /data/pt/cities.json`.
- **Deep-link:** montar a URL de busca do Aviasales e anexar o marker —
  `https://www.aviasales.com/search/{ORIG}{DDMM}{DEST}{DDMM}1?marker={MARKER}`
  (ou o redirect `https://tp.media/r?marker={MARKER}&p=4114&u=<url-encoded>`).
- **Live search (Aviasales Search API):** exige 50 k MAU → **fora do MVP**.

### Hotel — Hotellook API

- **Lookup de `locationId`:** `GET https://engine.hotellook.com/api/v2/lookup.json?query=<cidade>&lang=pt&lookFor=city&token=<TOKEN>`.
- **Preços em cache por cidade:** `GET https://engine.hotellook.com/api/v2/cache.json`
  params: `location` (nome ou `locationId`), `checkIn`, `checkOut` (YYYY-MM-DD),
  `currency=brl`, `limit`, `token`.
  Retorna: `hotelName`, `priceFrom` / `priceAvg`, `stars`, `location` (lat/lng),
  `hotelId`.
- **Deep-link:** `https://search.hotellook.com/hotels?destination=<cidade>&checkIn=<in>&checkOut=<out>&adults=2&marker={MARKER}`
  (ou redirect `tp.media`).

---

## 4. Modelo de dados

- **Sem tabela nova.** `provider_cache`, `flight_selections`, `hotel_selections` já existem (Passo 5).
- **`provider_cache.provider`:** verificar em `packages/db/src/schema.ts` se é enum PG ou `text`.
  - `text` → só trocar as strings no código. Sem migration.
  - enum PG → migration `0007` com `ALTER TYPE ... RENAME VALUE` (ou trocar por `text`).
- **DTOs `FlightOffer` / `HotelOffer` (`@farol/shared`):** os campos podem ficar iguais —
  `FlightOffer { id, priceTotal, carrier, stops, deepLink }`,
  `HotelOffer { id, name, pricePerNight, priceTotal, rating, region, deepLink }`.
  Só o `normalize-*` muda (shape de entrada novo). Ajustar os `.spec` correspondentes.
- **`*_selections.offer` (jsonb):** passa a guardar o objeto cru do Travelpayouts.
  É jsonb — **sem migration**; ajustar só os tipos TS do snapshot.

---

## 5. Config / env

Remover: `AMADEUS_BASE_URL`, `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`.

Adicionar:

| Var | Default | Nota |
|---|---|---|
| `TRAVELPAYOUTS_TOKEN` | — | segredo. Header `X-Access-Token`. |
| `TRAVELPAYOUTS_MARKER` | — | id de afiliado; vai em todo deep-link. Trata como env (não é segredo). |
| `TRAVELPAYOUTS_BASE_URL` | `https://api.travelpayouts.com` | Data API de voo. |
| `HOTELLOOK_BASE_URL` | `https://engine.hotellook.com` | API de hotel. |
| `FLIGHT_DEEPLINK_TEMPLATE` | — | agora com `{marker}` no conjunto de placeholders. |
| `HOTEL_DEEPLINK_TEMPLATE` | — | idem. |

Atualizar: `.env.example`, `apps/api/src/config/env.schema.ts`,
`.github/workflows/ci.yml` (bloco `env:` com valores fake `travelpayouts-ci` / `farol-ci`).
Reabre 1 linha do débito A2 (que estava fechado).

---

## 6. Camada de resiliência

- **Sem OAuth.** Apagar `AmadeusAuth` e o passo de token do `HealthModule`.
- `packages/providers/src/travelpayouts/http.ts` — adapta o `amadeusGet` existente:
  anexa `X-Access-Token` (ou `token=` na query, conforme o endpoint), `p-retry`
  (retries 3, só 429 / 5xx / erro de rede), passa por `CircuitBreaker`. 4xx (exceto 429) propaga.
- **Cache (TTL):** preço no Data API muda devagar — subir voo de 10 min → **30 min**;
  hotel `cache.json` → manter **1 h**.
- Rate limit do Travelpayouts Data API é generoso, mas existe — o retry/breaker cobre.

---

## 7. Deep-link e afiliado (a parte que vira receita)

- **Todo link de saída** (voo e hotel) carrega `marker={TRAVELPAYOUTS_MARKER}`.
- A comissão cai no painel do Travelpayouts — **sem reconciliação no Farol no MVP**.
- Atribuição própria (opcional): o `deep_link` já é gravado em `*_selections` (Passo 5) —
  serve de log de clique se quisermos medir conversão por conta.
- **Atualizar o design técnico:** D10 deixa de ser "afiliado fora do MVP" e vira
  "afiliado via `marker` do Travelpayouts desde o MVP".

---

## 8. Testes (baseline do projeto: 100% cobertura + unidade/integração/e2e/mutação)

**Contrato de provider** (`travelpayouts/__fixtures__/`, sem rede no CI)
- Regravar da API real: `prices_for_dates.json`, `prices_calendar.json`,
  `hotellook_lookup.json`, `hotellook_cache.json`.
- `normalizeFlight` / `normalizeHotel` contra a fixture: nº de ofertas, campos batendo
  o DTO, `stops`/`transfers` correto, `deepLink` com origem/destino/datas **e marker**.

**Unidade**
- `TravelpayoutsFlightProvider.search` com `fetchImpl` fake → ofertas ordenadas por preço;
  `maxStops: 0` filtra escalas.
- `TravelpayoutsHotelProvider.search` — `lookup.json` resolve `locationId`, depois
  `cache.json`; `pricePerNight` = total / noites; ordena por preço.
- Montagem do deep-link (template + placeholders + marker).
- `http.ts`: retenta em 503 e sucede; não retenta em 400; anexa o token no header certo.

**Integração (Postgres real, provider fake determinístico)**
- `FlightsModule` / `HotelsModule` com `provider_cache` real: cache hit não chama a rede;
  miss chama e grava.
- `flight_selections` / `hotel_selections` gravam snapshot cru + `deep_link`.

**E2E — API**
- `GET /trips/:id/flights` e `/hotels` devolvem ofertas normalizadas.
- Provider fora do ar → seção degradada, resto do roteiro intacto.

**Mutação:** ≥ 90 no `@farol/providers`.

---

## 9. Ordem de implementação (Rafinha)

1. **(felippe)** criar conta Travelpayouts → `TRAVELPAYOUTS_TOKEN` + `TRAVELPAYOUTS_MARKER`,
   ler a doc dos endpoints liberados, confirmar `currency=brl` em voo e hotel.
2. `travelpayouts/http.ts` (token no header + retry + breaker). Apagar `amadeus/amadeus-auth.ts`.
3. `TravelpayoutsFlightProvider` + `normalize-flight` + fixtures + testes.
4. `TravelpayoutsHotelProvider` + `normalize-hotel` + `lookup` + fixtures + testes.
5. `ProvidersModule` factory: `FLIGHT_PROVIDER` / `HOTEL_PROVIDER` montam Travelpayouts
   da env. Apagar `packages/providers/src/amadeus/**`.
6. `env.schema.ts` + `.env.example` + `ci.yml`. `HealthModule` troca o check.
7. `provider_cache.provider` — enum PG? migration `0007`; `text`? só strings.
8. E2E + mutação verdes. Atualizar `docs/superpowers/specs/2026-08-27-mvp-trip-design.md`
   §7.2, D8, D10 (ou marcar "coberto por esta spec").

---

## 10. Decisões abertas / confirmar ao criar a conta

- Quais endpoints são liberados por padrão vs por request (real-time é gated por MAU — não usamos).
- `currency=brl` funciona em `cache.json` de hotel? (voo sim; hotel historicamente `usd`/`rub` — checar).
- Formato final do deep-link: URL direta com `marker` vs redirect `tp.media`.
- Precisão do preço cacheado — validar contra o preço real no clique; UI mostra "preço aproximado".
- `prices_for_dates` traz `duration` e `transfers`? (deve trazer — confirmar para manter `flightTimeHours` / `stops`).
- Segundo provider (Duffel / SerpApi) como fallback para rotas não cobertas — **item futuro**, não MVP.
- **Skyscanner Partners:** aplicar depois do lançamento, quando houver tráfego — é a graduação natural.

---

## 11. O que a implementação decidiu (2026-09-02, Passo 10)

Esta seção fecha as decisões abertas de §10 com o que foi verificado contra a API real.

### Endpoints — o que a conta libera de fato

Os nove endpoints abaixo responderam com o token da conta e estão implementados em
`packages/providers/src/travelpayouts/`, cada um com fixture gravada da resposta real.
`aviasales/v3/prices_for_dates` e `v1/prices/calendar` (o caminho que §3 supunha) **não**
foram usados — os endpoints v1/v2 abaixo cobrem o mesmo e vieram confirmados.

| Endpoint | Papel no produto | Normalizador |
|---|---|---|
| `GET /v1/prices/cheap` | tarifa mais barata da rota no mês | `normalizeCheap` → `FlightOffer[]` |
| `GET /v1/prices/monthly` | melhor preço mês a mês — "quando ir" | `normalizeKeyedDeals` → `RouteDeal[]` |
| `GET /v1/city-directions` | destinos baratos saindo da origem — descoberta | `normalizeKeyedDeals` |
| `GET /v2/prices/latest` | faixa de preço recente da rota | `normalizeMatrixSamples` → `RoutePriceSample[]` |
| `GET /v2/prices/month-matrix` | preço por dia — melhor dia do mês | `normalizeMatrixSamples` |
| `GET /v2/prices/nearest-places-matrix` | aeroportos vizinhos, **com `link` da tarifa exata** | `normalizeNearestPlaces` → `FlightOffer[]` |
| `GET /whereami` (host `www.travelpayouts.com`) | origem provável pelo IP; responde **JSONP** | `parseJsonp` + `normalizeWhereami` |
| `GET /data/{locale}/airports.json` | catálogo de aeroportos (2,5 MB) | `normalizeAirports` |
| `GET /data/{locale}/airlines.json` | catálogo de companhias (117 KB) | `normalizeAirlines` |

**Hotellook: fora.** `engine.hotellook.com/api/v2/lookup.json` e `.../cache.json` devolvem
**404** com este token (idem `yasen.hotellook.com`). A conta não tem o programa de hotel
liberado. Consequência: `HOTEL_PROVIDER` só monta a Amadeus quando `AMADEUS_CLIENT_ID` e
`AMADEUS_CLIENT_SECRET` existirem; sem elas a busca recusa com `hotel_provider_not_configured`
e a seção de hotel degrada para `error: "unavailable"` — o roteiro segue de pé (§7.3).
Hotel volta a ter provider quando o Hotellook for liberado ou entrar outro afiliado.

### Respostas às decisões abertas de §10

- **`currency=brl` em voo:** funciona em todos os endpoints de preço. Default do provider.
- **Deep-link:** as duas formas convivem. Onde a API devolve `link` (nearest-places-matrix),
  usa-se a URL do Aviasales com o `marker` anexado — cai na tarifa exata. Nos demais, o
  `FLIGHT_DEEPLINK_TEMPLATE` monta a busca (`/search/{origin}{departDdmm}{destination}{returnDdmm}{passengers}?marker={marker}`).
  Sem redirect `tp.media`.
- **`duration` e `transfers`:** vêm nos dois formatos. `nearest-places-matrix` traz
  `main_airline`, `transfers` e `duration` em minutos; `month-matrix`/`latest` trazem
  `number_of_changes` e `duration`, **mas não a companhia** — por isso viraram
  `RoutePriceSample` (amostra de preço), não `FlightOffer`. Inventar `carrier` seria mentir.
- **Data exata vs mês:** `nearest-places-matrix` com `depart_date` **e** `return_date`
  exatos volta vazio na maioria das rotas; `/v1/prices/cheap` com **mês** (`YYYY-MM`)
  responde de forma confiável. Por isso `search()` chama as duas fontes em paralelo
  (`Promise.allSettled`), funde por id e ordena por preço: uma fonte fora do ar não zera
  a seção; as duas fora propagam o erro.
- **Precisão do preço:** é cache. `FLIGHT_CACHE_TTL_SECONDS` subiu de 600 para **1800**.
  A UI mostra o aviso de preço aproximado junto das ofertas e o system prompt do chat
  obriga o assessor a dizer isso ao citar valor.

### Superfície nova

- API: `GET /trips/:id/flights/{nearby,calendar,latest,months,directions}` e o
  `GeoModule` público (`GET /geo/whereami`, `/geo/airports?q=`, `/geo/airports/:iata`,
  `/geo/airlines/:code`).
- Chat: 5 tools novas (11 → 16) — `price_calendar`, `best_months`, `price_range`,
  `nearby_airports`, `cheap_destinations`.
- `@farol/shared`: `RoutePriceSample`, `RouteDeal`, `GeoLocation`, `Airport`, `Airline`.
  `FlightOffer.durationMinutes` passou a aceitar `0` — o cache nem sempre traz duração.
- Envs: `TRAVELPAYOUTS_TOKEN`, `TRAVELPAYOUTS_MARKER`, `TRAVELPAYOUTS_BASE_URL`,
  `TRAVELPAYOUTS_CURRENCY`, `GEO_DUMP_TTL_SECONDS`. `AMADEUS_CLIENT_ID`/`SECRET` viraram
  **opcionais**. Credenciais vão no Doppler (`farol/dev` e `farol/prd`), nunca em `.env`.
