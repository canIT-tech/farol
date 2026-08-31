# Passo 7 — Chat IA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `ChatModule` with NestJS endpoint `POST /trips/:id/chat`, Claude tool-calling loop with 9 domain tools, state persistence in `chat_messages`, and integration/unit tests.

**Architecture:** NestJS `ChatModule` wrapping Anthropic Claude tool-calling loop. Controller exposes authenticated `POST /trips/:id/chat { message }`. Service loads history from `chat_messages`, constructs system prompt with trip state context, calls `LlmService`, processes tool calls against domain services (`TripsService`, `ItineraryService`, `ProfileService`, `HotelsService`, `FlightsService`, `PlacesService`), persists all turns, and returns assistant message + updated `TripState`.

**Tech Stack:** NestJS, Drizzle ORM, Supabase Auth, Anthropic SDK (via `LlmModule`), Vitest, StrykerJS.

**Spec:** `docs/superpowers/specs/2026-08-27-mvp-trip-design.md` §6.4

---

## Global Constraints

- **Coverage:** 100% statements/branches/functions/lines for `@farol/db`, `apps/api`, `@farol/shared`.
- **Mutation score:** ≥ 90% in StrykerJS.
- **TDD:** Write unit/integration tests before writing implementation code.
- **LLM in tests:** Deterministic fake via `LlmService` mock / fake LLM client.

---

### Task 1: Schema Migration & Shared DTOs for Chat

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0006_chat_messages.sql`
- Create: `packages/shared/src/chat.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/chat.spec.ts`

**Interfaces:**
- Consumes: `@farol/db` schema, `@farol/shared` schemas.
- Produces: `chatMessages` table in `@farol/db`, `ChatMessageDto`, `ChatRequestDto`, `ChatResponseDto` in `@farol/shared`.

- [ ] **Step 1: Write failing DTO test in packages/shared/src/chat.spec.ts**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Define chatMessages schema in packages/db/src/schema.ts, generate migration 0006_chat_messages.sql, export DTOs in packages/shared/src/chat.ts**
- [ ] **Step 4: Run tests and verify 100% coverage**
- [ ] **Step 5: Commit task**

---

### Task 2: Tool Registry & Handlers (`ChatToolService`)

**Files:**
- Create: `apps/api/src/chat/chat-tools.service.ts`
- Create: `apps/api/src/chat/chat-tools.service.spec.ts`
- Create: `apps/api/src/chat/chat-tools.types.ts`

**Interfaces:**
- Consumes: `TripsService`, `ItineraryService`, `ProfileService`, `HotelsService`, `FlightsService`, `PlacesService`.
- Produces: `ChatToolService.executeTool(tripId, userId, toolCall): Promise<ToolResult>` and 9 Anthropic tool definitions.

Tools:
1. `set_destination({ iata: string })`
2. `shift_dates({ dateStart: string, dateEnd: string })`
3. `set_budget({ budgetTotal: number })`
4. `add_interest({ tag: string })` / `remove_interest({ tag: string })`
5. `regenerate_day({ dayIndex: number })`
6. `remove_item({ itemId: string })` / `pin_item({ itemId: string })`
7. `find_hotel({ near?: string })`
8. `swap_restaurant({ itemId: string, cuisine?: string })`
9. `search_flights()`

- [ ] **Step 1: Write failing unit test in chat-tools.service.spec.ts testing all 9 tool executions**
- [ ] **Step 2: Run test to confirm failure**
- [ ] **Step 3: Implement ChatToolService mapping tool calls to existing service methods**
- [ ] **Step 4: Run tests and verify 100% unit coverage**
- [ ] **Step 5: Commit task**

---

### Task 3: Chat Service & Tool Loop (`ChatService`)

**Files:**
- Create: `apps/api/src/chat/chat.service.ts`
- Create: `apps/api/src/chat/chat.service.spec.ts`
- Create: `apps/api/src/chat/chat.repository.ts`
- Create: `apps/api/src/chat/chat.repository.spec.ts`

**Interfaces:**
- Consumes: `LlmService`, `ChatToolService`, `chatMessages` table.
- Produces: `ChatService.sendMessage(userId, tripId, userMessage): Promise<ChatResponseDto>`.

- [ ] **Step 1: Write failing unit tests for ChatRepository and ChatService tool-calling loop**
- [ ] **Step 2: Run tests to confirm failure**
- [ ] **Step 3: Implement ChatRepository for DB queries and ChatService with Claude tool-calling loop**
- [ ] **Step 4: Run unit tests and verify 100% coverage**
- [ ] **Step 5: Commit task**

---

### Task 4: Chat Controller & Module (`ChatModule`)

**Files:**
- Create: `apps/api/src/chat/chat.controller.ts`
- Create: `apps/api/src/chat/chat.controller.spec.ts`
- Create: `apps/api/src/chat/chat.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/chat/chat.e2e-spec.ts`

**Interfaces:**
- Consumes: `ChatService`, `@farol/shared` DTOs, `AuthGuard`.
- Produces: `POST /trips/:id/chat` endpoint.

- [ ] **Step 1: Write failing controller test and E2E integration test**
- [ ] **Step 2: Run tests to confirm failure**
- [ ] **Step 3: Implement ChatController and ChatModule, register in AppModule**
- [ ] **Step 4: Run unit and integration tests and verify 100% coverage**
- [ ] **Step 5: Commit task**

---

### Task 5: End-to-End Verification & Mutation Testing

**Files:**
- Test: Full integration test suite in `apps/api`
- Run: `pnpm test`, `pnpm test:e2e`, `pnpm test:mutation`

- [ ] **Step 1: Run full test suite across workspace**
- [ ] **Step 2: Run Stryker mutation tests for api and shared**
- [ ] **Step 3: Fix any surviving mutants or un-covered lines**
- [ ] **Step 4: Commit and open Pull Request**
