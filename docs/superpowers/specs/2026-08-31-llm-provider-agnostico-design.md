# Design Técnico — Camada de LLM agnóstica de provider

> Status: proposto · 2026-08-31 · Autor: rafaignaulin (com Claude)
> Refatora o que os Passos 3, 4 e 7 construíram. Não adiciona feature de produto.

## 1. Problema

Hoje a camada de LLM está presa à Anthropic em quatro lugares:

| Onde | Acoplamento |
|---|---|
| `apps/api/src/llm/llm.module.ts` | `new Anthropic({ apiKey })` direto na factory |
| `apps/api/src/llm/llm.service.ts` | `AnthropicLike` espelha o formato de fio da Anthropic (`messages.create`, `content[]`, `input_tokens`) |
| `apps/api/src/chat/chat.service.ts` | monta blocos `tool_use` / `tool_result` à mão (linhas 49–148) e lê `content[]` |
| `apps/api/src/chat/chat-tools.types.ts` | `input_schema` é o nome da Anthropic; OpenAI/Groq usam `parameters` |

Trocar de provider hoje significa reescrever os quatro. O objetivo é trocar **um** arquivo
de configuração.

Junto disso, a auditoria da spec §6 revelou três lacunas que esta refatoração fecha
por consequência natural:

- **Roteamento de modelo não existe.** `LLM_MODEL_CHEAP` está na env, tem default, e não é
  lido em lugar nenhum. Tudo roda no modelo caro. A spec §6.5 pede roteamento por tarefa.
- **"JSON schema forçado" não é forçado.** `runWithRetry` chama o modelo sem `tools` e sem
  schema: é prompt + `extractJsonObject` catando `{` no meio da prosa + 2 tentativas. Frágil
  com modelo bom, quebradiço com modelo fraco.
- **`trip_id` não vai no log de custo.** A spec §6.5 pede; sem ele a Q3 ("teto de custo por
  roteiro") é insolúvel, porque não dá para somar custo por roteiro.

## 2. Objetivo e não-objetivos

**Objetivo.** Trocar de provider (Anthropic / Groq / OpenAI) e trocar de modelo dentro do
mesmo provider por configuração, sem tocar em nenhum consumidor. Toda a aplicação escolhe
modelo por **tier de custo**, não por nome de modelo.

**Não-objetivos.**

- Rodar dois providers ao mesmo tempo. O desenho não impede, mas a config nesta fase resolve
  um provider por vez (opção C acordada no brainstorming).
- Streaming. Nenhum consumidor atual precisa.
- Guard-rails do chat (rate limit por usuário, timeout por tool). Débito separado da spec §6.4;
  não se mistura com troca de provider.
- Mexer nos prompts. Eles seguem como estão.

## 3. Decisões

### D1 — Porta neutra, vocabulário próprio

O app não fala o dialeto de fornecedor nenhum, **nem o da biblioteca**. Tipos próprios em
`apps/api/src/llm/llm.types.ts`:

```ts
type LlmRole = "system" | "user" | "assistant" | "tool";

interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface LlmMessage {
  role: LlmRole;
  content: string | null;
  toolCalls?: LlmToolCall[];   // assistant que chamou tool
  toolCallId?: string;         // resposta de tool
}

interface LlmToolSpec {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;    // zod, não JSON Schema à mão
}

interface LlmCompletion {
  text: string;
  toolCalls: LlmToolCall[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
  completeStructured<T>(request: LlmStructuredRequest<T>): Promise<T>;
}
```

**Por que `LlmToolCall` tem essa forma:** é exatamente a que `ChatMessageDto` já persiste em
`chat_messages` (`toolCalls`, `toolCallId`). A porta neutra fica igual ao que já está no banco,
então some tradução na borda de persistência — hoje feita à mão em `chat.service.ts`.

**Por que `parameters` é zod e não JSON Schema:** o projeto valida tudo em zod. Hoje
`chat-tools.types.ts` escreve JSON Schema à mão, duplicando o que o zod já descreveria, e sem
validar de fato a entrada da tool. Com zod, a mesma definição gera o schema para o modelo **e**
valida o `args` que volta.

### D2 — Vercel AI SDK como implementação, atrás da porta

`AiSdkLlmProvider implements LlmProvider` usa `ai@7` (`generateText`, `generateObject`, `tool`).

Alternativas descartadas:

- **Adaptadores escritos à mão por fornecedor.** A parte difícil — traduzir tool-calling entre
  blocos `tool_use`/`tool_result` da Anthropic e `tool_calls[]` com `arguments` string da
  OpenAI/Groq — é onde moram os bugs, e é o núcleo do que a biblioteca já resolve e testa.
- **Usar a biblioteca direto, sem porta.** Trocaria acoplamento em `@anthropic-ai/sdk` por
  acoplamento em `ai`. O SDK tem histórico de breaking change entre majors; com a porta, o
  estrago de um major fica em um arquivo.

**Custo aceito:** acompanhar versão do AI SDK. É um custo diferente, não a ausência de custo.

### D3 — Seleção por tier, não por nome de modelo

```ts
type LlmTier = "cheap" | "capable";
```

Call site pede tier. A config resolve `tier → (provider, modelId)`. Mapeamento:

| Tarefa | Tier | Motivo |
|---|---|---|
| `rankDestinations` | `capable` | julgamento subjetivo sobre gosto |
| `buildItinerary` | `capable` | saída longa e estruturada |
| `chat` | `capable` | tool-calling exige obediência |

Nenhuma tarefa usa `cheap` hoje. O tier existe para que passar qualquer uma para o barato seja
mudar uma linha, e para que a spec §6.5 pare de descrever algo inexistente. Não inventamos
tarefa nova só para exercitar o `cheap`.

### D4 — Env

```
LLM_PROVIDER=anthropic|groq|openai     (novo, opcional — ver D4.1)
LLM_API_KEY=<chave do provider>        (novo, opcional — substitui ANTHROPIC_API_KEY)
LLM_MODEL_CAPABLE=<id do modelo>       (mantém o nome; perde o default)
LLM_MODEL_CHEAP=<id do modelo>         (mantém o nome; perde o default)
```

`ANTHROPIC_API_KEY` é **removida**. Uma chave só, porque é um provider por vez (§2).

Os dois `LLM_MODEL_*` mantêm o nome, mas **perdem o default**: hoje têm um id de modelo
Anthropic embutido no schema, o que fica errado sob qualquer outro provider. Um default
inválido falha em runtime, no meio de um job; sem default, o erro aparece no boot.

Todas são opcionais, mas interdependentes — a regra está em D4.1.

### D4.1 — LLM é opcional no boot

As quatro envs de LLM são **opcionais**. A aplicação sobe sem nenhuma delas.

Hoje `ANTHROPIC_API_KEY` é obrigatória, então nada roda sem chave de LLM: nem a landing,
nem o login, nem viagens, nem Places. Isso acopla o app inteiro a um fornecedor pago só para
existir, e é o que trava quem clona o repo para rodar local.

Regra do schema, via `superRefine`:

- Nenhuma das quatro presente → LLM desligado.
- `LLM_PROVIDER` presente → `LLM_API_KEY`, `LLM_MODEL_CAPABLE` e `LLM_MODEL_CHEAP` passam a
  ser obrigatórias. Meia configuração é erro de boot, não falha silenciosa em runtime.

Com LLM desligado, `LlmModule` injeta um `DisabledLlmProvider` que lança
`DomainError("llm_not_configured", ...)` **na chamada**, não no boot. Consequências:

| Fluxo | Sem LLM |
|---|---|
| Landing, waitlist, login, onboarding, CRUD de viagem | funcionam |
| Places, enrich, `swap_restaurant` | funcionam (não usam LLM) |
| Descoberta de destino, geração de roteiro, chat | erro claro `llm_not_configured` |

`llm_not_configured` mapeia para **503** no `DomainExceptionFilter` — é indisponibilidade de
configuração, não erro do cliente. No job de roteiro, cai no caminho de falha que já existe:
`itineraries.status = failed` com a mensagem.

Isto é o que torna o LLM de fato um módulo desacoplado, e não só um fornecedor trocável.

### D5 — Saída estruturada de verdade

`rankDestinations` e `buildItinerary` passam a usar `completeStructured` com o schema zod que
já existe (`llmRankingSchema`, `buildItineraryOutputSchema`), via `generateObject` do AI SDK.

Consequência: `extractJsonArray`, `extractJsonObject`, `parseRanking` e `parseItineraryOutput`
**são deletados**. O retry com feedback (`MAX_ATTEMPTS = 2`) também sai — o AI SDK já repara
saída malformada internamente, e sobrepor dois mecanismos de retry esconde erro.

A validação de negócio que o parse fazia e o schema não faz — "nenhum `iata` fora da
shortlist" — vira uma checagem explícita em `LlmService.rankDestinations`, depois da chamada.
Isso é regra de domínio, não formato: o lugar certo dela é o serviço, não o parser.

### D6 — `chat` entra na porta

`chat()` hoje não está em `LlmPort`, e `ChatService` injeta a **classe concreta** `LlmService`.
Por isso `FakeLlmService` não implementa `chat` e o chat furou a abstração.

Passa a: `LlmPort` ganha `chat(...)`, `ChatService` injeta o token `LLM`, `FakeLlmService`
implementa os três métodos. O loop de tool-calling em `chat.service.ts` perde as ~40 linhas
que montam blocos à mão e passa a ler `completion.toolCalls`.

### D7 — Log de custo ganha `tripId`

`LlmCallMetrics` ganha `tripId: string | null`. `MODEL_PRICING` passa a ser chaveado por
`provider:model`, com entrada de custo zero para os modelos gratuitos do Groq — hoje qualquer
modelo desconhecido cai no fallback de preço do Sonnet e loga custo fictício.

## 4. Arquitetura

```
apps/api/src/llm/
  llm.types.ts          porta + tipos neutros + tiers + métricas   (reescrito)
  llm.service.ts        regra de negócio; fala só a porta          (reescrito)
  llm.module.ts         resolve tier → provider/modelo; injeta     (reescrito)
  fake-llm.service.ts   fake determinístico dos 3 métodos          (estendido)
  providers/
    ai-sdk.provider.ts  único ponto que importa `ai`               (novo)
  prompts/              inalterado
```

Fluxo de uma chamada:

```
ItineraryGenerateHandler
  └─ LlmService.buildItinerary(input)        // domínio, tipos do @farol/shared
       └─ LlmProvider.completeStructured({ tier: "capable", schema, ... })
            └─ AiSdkLlmProvider              // único lugar que conhece `ai`
                 └─ generateObject({ model: resolve(tier), schema })
```

`chat.service.ts` some da lista de arquivos acoplados: passa a consumir `LlmCompletion` com
`toolCalls` já normalizados.

## 5. Tratamento de erro

| Situação | Comportamento |
|---|---|
| LLM não configurado | `DomainError("llm_not_configured", ...)` na chamada → **503**. App sobe normal; só os fluxos de LLM recusam (D4.1) |
| Provider fora do ar / rede | erro propaga; no job, `itineraries.status = failed` (igual hoje) |
| Saída não bate o schema | `DomainError("llm_invalid_output", ...)`, mesmo código de hoje — contrato HTTP 502 preservado |
| `iata` fora da shortlist | idem, `llm_invalid_output` |
| Tool com `args` inválido | `ToolResult { isError: true }`; o loop devolve ao modelo, não estoura o request (igual hoje) |

Nenhum código de erro novo. O contrato HTTP não muda.

## 6. Testes

- **Unidade:** `LlmService` com `LlmProvider` fake em memória. Nenhuma rede. É a maior parte.
- **Contrato do adaptador:** `AiSdkLlmProvider` contra o mock de modelo que o próprio SDK
  publica em `ai/test` (exporta `MockLanguageModelV3` e `MockLanguageModelV4` — usar a versão
  que o `ai@7` instalado espera). Verifica a tradução nos dois sentidos: `LlmMessage[]` para
  mensagens do SDK, e resposta do SDK para `LlmCompletion`. Sem rede no CI.
- **Integração:** `chat.service.ts` com `FakeLlmService` que devolve `toolCalls` — hoje o teste
  monta blocos `tool_use` à mão, o que some.
- **Fake:** `FakeLlmService` implementa `chat` devolvendo uma `LlmCompletion` determinística,
  com modo que força tool call para exercitar o loop.

Cobertura 100% por pacote e mutação ≥ 90% seguem valendo: o adaptador é o único arquivo com
superfície de terceiro, e é fino o bastante para cobrir inteiro.

## 7. Riscos

| Risco | Mitigação |
|---|---|
| **Faixa de zod declarada abaixo do peer.** `ai@7` exige `zod ^3.25.76 \|\| ^4.1.8`; `apps/api`, `apps/web` e `packages/shared` declaram `^3.23.0`. | **Risco menor do que parecia:** o `pnpm-lock.yaml` já resolve `zod@3.25.76`, que satisfaz o peer. Só a faixa declarada sobe para `^3.25.76`; nenhuma dependência muda de versão instalada. Mesmo assim é o primeiro passo, com a suíte verde como gate. |
| **Churn do AI SDK.** Major novo quebra API. | A porta isola: o estrago fica em `ai-sdk.provider.ts`. Versão pinada exata no `package.json`. |
| **Modelo do Groq desobedece.** Modelos abertos erram mais em JSON estrito e tool-calling. | `generateObject` força schema, o que é estritamente melhor que o prompt+parse de hoje. Ainda assim, provider gratuito pode falhar mais; a decisão de qual modelo usar continua sendo config, não código. |
| **Refatorar o chat recém-mergeado.** Passo 7 entrou hoje e seus testes de integração nunca rodaram fora do CI. | Rodar a suíte do Passo 7 verde **antes** de encostar nela, para separar bug pré-existente de regressão do refactor. |

## 8. Migração

Cada passo deixa a suíte verde antes do próximo.

1. Bump do zod, suíte inteira verde. Gate: se falhar, para aqui.
2. Tipos neutros + `LlmProvider` em `llm.types.ts`. Nada consome ainda.
3. `AiSdkLlmProvider` + testes de contrato contra o mock do SDK.
4. `LlmService` passa a falar a porta; `extractJson*` e o retry saem; a checagem de shortlist entra.
5. `chat` entra em `LlmPort`; `ChatService` passa a injetar o token `LLM`; o loop lê `toolCalls`.
6. `chat-tools.types.ts`: `input_schema` JSON Schema à mão → `parameters` zod.
7. Env (D4), `llm.module.ts`, `.env.example`, `ci.yml`, remoção do `@anthropic-ai/sdk`.

Passo 7 da lista é o único que exige mudança de env em quem já roda local. Vai documentado
no `README.md` junto do aviso de que o projeto não carrega `.env` (não há `dotenv`).

## 9. Questões abertas

| ID | Questão | Encaminhamento |
|---|---|---|
| L1 | Qual modelo do Groq para `capable`? | Decidir na implementação, medindo obediência a `generateObject` no `buildItinerary`, que é a saída mais longa |
| L2 | Preço dos modelos em `MODEL_PRICING` por provider | Groq gratuito entra como 0; revisar quando houver plano pago |
| L3 | Q3 da spec original (teto de custo por roteiro) | Continua aberta. Este design entrega o `tripId` no log, que é o pré-requisito para respondê-la |
