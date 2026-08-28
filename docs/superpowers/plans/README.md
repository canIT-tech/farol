# Planos de implementação — Farol

Um plano por passo do backlog do `CLAUDE.md`. Cada plano é bite-sized (tasks TDD:
teste que falha → implementação → teste passa → mutação → commit) e cobre a
**Definition of Done** do projeto (cobertura 100% por pacote + unidade/integração/e2e/mutação).

## Escritos

| Passo | Plano | Arquivo |
|---|---|---|
| 1 | Fundação do monorepo | `2026-08-28-fundacao-monorepo.md` |
| 2 | Auth + Perfil de gosto | `2026-08-28-auth-perfil.md` |

## A escrever (just-in-time, antes de puxar o passo)

Os planos abaixo são **esboços**. O plano detalhado de cada um é escrito quando o
passo anterior estiver perto de concluir — decisões de um passo mudam o próximo,
então detalhar tudo agora só cria documento que envelhece.

### Passo 3 — Viagens + Descoberta de destino
- **Objetivo:** criar viagem → catálogo seed + pré-filtro determinístico + ranking via Claude → 3–5 destinos com justificativa persistidos.
- **Pacotes/arquivos:** `packages/db` (`trips`, `trip_destinations`, `destination_catalog` + migration + seed CSV ~200 cidades); `packages/domain` (pré-filtro: orçamento, melhor época, visto); `apps/api` `LlmModule` (client Claude + roteamento de modelo + log de custo/tokens), `TripsModule` (CRUD + `TripState`), `DiscoveryModule` (shortlist → `LlmService.rankDestinations` com saída zod-validada + 1 retry).
- **Tasks previstas:** (1) schema trips/trip_destinations + migration; (2) destination_catalog + seed script; (3) shared DTOs (trip input, destination result); (4) domain pré-filtro; (5) LlmModule + fake determinístico de teste; (6) TripsModule CRUD; (7) DiscoveryModule + e2e.
- **Riscos:** formato/curadoria do catálogo (começar CSV); teto de custo de LLM por chamada (definir número — pendência do PRD); validação estrita da saída do LLM.
- **Testes:** LLM sempre em fake determinístico; e2e "cria trip → recebe 3–5 destinos".

### Passo 4 — Roteiro + Jobs (pg-boss)
- **Objetivo:** escolher destino → job assíncrono gera roteiro dia a dia → web faz polling até `ready`.
- **Arquivos:** `packages/db` (`itineraries`, `itinerary_days`, `itinerary_items` + migration; schema `pgboss`); `apps/worker` (bootstrap real: Config + Jobs + Itinerary + Llm + db, sem HTTP); `apps/api` `JobsModule` (setup pg-boss, retry/backoff, dead-letter log), `ItineraryModule` (cria `itineraries(pending)`, enfileira `itinerary.generate`, serve o itinerário).
- **Tasks previstas:** (1) schema itinerary* + migration; (2) JobsModule/pg-boss + teste com fila real; (3) worker bootstrap; (4) LlmService.buildItinerary (JSON schema forçado) + fake; (5) job handler `itinerary.generate` (sem enrich ainda); (6) ItineraryModule + endpoint + polling; (7) e2e.
- **Riscos:** latência p95 ≤ 15 s (design §1.3); idempotência do job; itens `pinned` preservados na regeneração.
- **Pode paralelizar com o Passo 5 depois do 3.**

### Passo 5 — Providers Amadeus (voo + hotel)
- **Objetivo:** buscar voos e hotéis reais de uma trip, com cache, retry e deep link.
- **Arquivos:** `packages/providers` (interfaces `FlightProvider`/`HotelProvider`; `AmadeusFlightProvider`, `AmadeusHotelProvider`; OAuth2 client-credentials com token em cache; `AMADEUS_BASE_URL` configurável; `p-retry` + circuit breaker simples); `packages/db` (`provider_cache`, `flight_selections`, `hotel_selections` + migration); `apps/api` `FlightsModule`/`HotelsModule`.
- **Tasks previstas:** (1) schema cache/selections + migration; (2) contratos + DTOs normalizados em shared; (3) AmadeusAuth (token cache) + testes; (4) AmadeusFlightProvider contra fixtures gravadas do sandbox; (5) AmadeusHotelProvider idem; (6) provider_cache (chave=hash, TTL); (7) FlightsModule/HotelsModule + e2e com fixtures.
- **Riscos:** rate limit do sandbox; formato de deep link (site parceiro — pendência do PRD); gravar fixtures reais uma vez.
- **Testes:** contrato contra `__fixtures__`, sem rede no CI.

### Passo 6 — Google Places + enrich
- **Objetivo:** itens do roteiro ganham lugar real (place_id, coords, avaliação); refeições preenchidas; `swap_restaurant`.
- **Arquivos:** `packages/providers` (`GooglePlacesProvider`: text search + details); `apps/api` `PlacesModule`; passo de **enrich** plugado no job `itinerary.generate` (Passo 4); job `places.enrich` para reprocessar `needs_review`.
- **Tasks previstas:** (1) GooglePlacesProvider + fixtures; (2) PlacesModule; (3) enrich no handler do roteiro (item sem place_id → text search; sem match → `needs_review`); (4) preenchimento de refeição por cozinha/preço perto do centroide do dia; (5) `swap_restaurant`; (6) job `places.enrich`; (7) e2e "roteiro tem itens com place real".
- **Riscos:** custo por chamada Places (cachear 24 h); degradação graciosa (item renderiza sem lugar).
- **Depende do Passo 4.**

### Passo 7 — Chat IA (tool-calling)
- **Objetivo:** "tira o dia de museu" muta o `TripState`; `chat_messages` persistido.
- **Arquivos:** `packages/db` (`chat_messages` + migration); `apps/api` `ChatModule` (`POST /trips/:id/chat`, loop de tool-calling do Claude, 9 tools mapeadas 1:1 para métodos de serviço — `set_destination`, `shift_dates`, `set_duration`, `set_budget`, `add_interest`/`remove_interest`, `regenerate_day`, `remove_item`/`pin_item`, `find_hotel`, `swap_restaurant`, `search_flights`).
- **Tasks previstas:** (1) schema chat_messages + migration; (2) definição das tools (schemas zod de input) + roteador para os serviços; (3) loop de tool-calling com fake determinístico; (4) cada tool ligada ao serviço real (Trips/Itinerary/Flights/Hotels/Places); (5) guard-rails (turnos/min, tokens/turno, timeout por tool); (6) persistência de mensagens; (7) e2e "mensagem → TripState muda".
- **Riscos:** estado da viagem no Postgres é a fonte da verdade (chat só dispara mutação); undo = versões de itinerário; custo do loop.
- **Depende dos Passos 4, 5, 6.**

### Passo 8 — UI web + E2E
- **Objetivo:** telas hi-fi (`*.dc.html`) realizadas em React, ligadas ao `apps/api`; fluxo Playwright completo.
- **Arquivos:** `apps/web/src/app/*` (descoberta input + resultados, roteiro, voo/hotel, modo autônomo), consumindo `apiFetch`; `AppShell`, `AdvisorChat`, `DestinationCard` etc. do `packages/ui` (Passo 9).
- **Tasks previstas:** uma por tela (input, resultados, roteiro, voo/hotel, autônomo), cada uma com componentes de lógica testados em unidade + a tela coberta por e2e; task final = e2e ponta a ponta login→onboarding→descoberta→destino→roteiro e o fluxo autônomo.
- **Riscos:** paridade com o design; estados de loading/polling do roteiro; responsivo < 1080 px (shell colapsa).
- **Depende do Passo 7.**

### Passo 9 — `packages/ui`
- **Objetivo:** tokens de `docs/design-system.md` + componentes base implementados e testados.
- **Arquivos:** `packages/ui/src/tokens` (CSS vars claro/escuro), `Button`, `TextField` (+ Stepper, Slider), `Chip`, `MatchBadge`, `DestinationCard`, `AppShell`, `StepNav`, `AdvisorChat` — cada um `Componente.tsx` + `.stories.tsx` + `.spec.tsx`.
- **Tasks previstas:** (1) tokens + tema; (2) Button (variantes/tamanhos/estados); (3) TextField + derivados; (4) Chip; (5) MatchBadge + barra; (6) DestinationCard; (7) AppShell + StepNav; (8) AdvisorChat.
- **Riscos:** decidir lib headless (Radix p/ overlays — pendência do `CLAUDE.md`); estratégia de tokens em runtime (CSS vars + `data-theme`).
- **Pode começar em paralelo a partir do Passo 1.**
