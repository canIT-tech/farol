# Consolidação dos Passos 1–9 — Plano de Correção

> **Substitui** `2026-08-29-correcao-debito-tecnico.md`, que cobria só os Passos 2–5 e
> ficou desatualizado depois do Passo 6, do Passo 7 e do refactor de LLM. Os itens
> daquele plano que já foram resolvidos estão marcados aqui como tal; os que seguem
> abertos foram reescritos com a evidência atual.

**Quando executar:** depois do Passo 8. O Passo 8 é o que falta pra existir produto;
isto é o que falta pra ele estar sólido. Dois itens (D1, D2) são exceção — precisam
de decisão *antes* do Passo 8 porque a UI que ele constrói depende deles.

**Regra:** todo item que toca código passa pelos mesmos gates (cobertura 100% por
pacote, mutação ≥ break). Itens de config validam com `pnpm build && pnpm typecheck &&
pnpm lint && pnpm test && pnpm test:e2e` verdes.

---

## Bloco D — Decidir antes do Passo 8

### D1. Descoberta devolve clima e tempo de voo falsos — FEITO (2026-09-01)

- **Evidência:** `apps/api/src/discovery/discovery.service.ts:130` — `expectedC:
  DEFAULT_EXPECTED_C`, 22 °C fixo para qualquer destino em qualquer mês. Linhas 91 e
  134 — `flightTimeHours: null`.
- **Por que agora:** a tela de resultados do Passo 8 exibe esses campos. Publicar
  "22 °C" para Oslo em janeiro é pior do que não mostrar nada, e a marca se define como
  "honesto sobre incerteza" (`docs/design/brand/Voice.dc.html`).
- **Feito pela opção (b).** `climate.expectedC` virou `z.number().nullable()` e a
  descoberta passa `null` em vez de 22 — `DEFAULT_EXPECTED_C` foi removido. O que sai do
  catálogo e é real (`summary`, `bestMonths`) continua. `flightTimeHours` já era
  `null` e já era nullable no schema.
- A UI não renderiza nenhum dos dois: `DestinationResults.stats()` mostra só custo, com
  teste garantindo que 22 °C e tempo de voo não aparecem.
- Falta (a), a fonte de verdade. Quando existir, é só preencher — nenhuma migration:
  `trip_destinations.climate` é jsonb.

### D2. Catálogo com 23 destinos

- **Evidência:** `packages/db/data/destinations.csv` tem 24 linhas — 23 destinos mais
  cabeçalho. A spec pede ~200.
- **Por que agora:** com 23 cidades o pré-filtro não filtra e o ranking recebe quase o
  catálogo inteiro. Não dá pra avaliar a qualidade da descoberta que o Passo 8 vai
  exibir, nem se o prompt de ranking presta.
- **É curadoria, não código.** Alguém precisa escrever as linhas.
- **Pronto quando:** ~200 destinos no CSV e `pnpm --filter @farol/db db:seed` aplicando
  todos.

---

## Bloco E — Qualidade dos Passos 1–9

### E1. Fixtures do Google Places escritas à mão

- **Evidência:** `packages/providers/src/google/__fixtures__/text-search.json` e
  `details.json` foram escritos sem chamar a API (não havia credencial na época).
- **Consequência:** os testes de contrato do Passo 6 validam o normalizador contra um
  formato presumido. Se a Places API v1 devolver algo diferente, o teste passa e a
  produção quebra.
- **Fazer:** gravar as duas respostas reais com a `GOOGLE_PLACES_KEY` e substituir,
  removendo qualquer dado pessoal. Ajustar o normalizador ao que vier.
- **Fixtures do Amadeus ficam de fora** — o provider morre no Passo 10.
- **Pronto quando:** as fixtures vêm de resposta real e os testes passam sem alterar a
  intenção das asserções.

### E2. `prefilterDestinations({ excludeIata })` sem chamador — FEITO (2026-09-01)

- **Evidência:** `packages/domain/src/discovery/prefilter.ts:46` declara o campo e a
  linha 54 o usa; nenhum código de produção passa o argumento. Não existe conceito de
  "destino rejeitado" no schema.
- **Fazer:** apagar o parâmetro e os testes dele. Se o produto quiser "não me mostre
  mais esse destino", isso vira feature com tabela, não flag órfã.
- Removido o campo, o `Set` de exclusão, o `filter` e o teste dele. `@farol/domain`
  segue 100% com 24 testes. Quando existir "rejeitar destino", vira feature com coluna,
  não flag órfã.

### E3. `MODEL_PRICING` é chute

- **Evidência:** `apps/api/src/llm/llm.types.ts:134` diz "Preços aproximados […]
  revisar". As linhas 141–142 dão custo **zero** para os dois modelos Groq.
- **Consequência:** todo cálculo de custo por roteiro sai errado, e com Groq sai zero —
  o que torna qualquer teto de orçamento inoperante nesse provider.
- **Fazer:** conferir os quatro preços na tabela oficial de cada fornecedor e anotar a
  data da consulta ao lado.
- **Pronto quando:** os valores batem com a fonte e o comentário diz de quando são.

### E4. Nenhum modelo Groq foi medido (item L1 da spec de LLM)

- **Evidência:** `docs/superpowers/specs/2026-08-31-llm-provider-agnostico-design.md`,
  item L1. `llama-3.3-70b-versatile` e `llama-3.1-8b-instant` entraram no
  `MODEL_PRICING` por palpite meu, nunca por medição.
- **Fazer:** rodar `buildItinerary` com Groq e medir se o `generateObject` obedece ao
  schema com a mesma confiabilidade do Anthropic. É o critério que define o tier
  `capable` do provider gratuito.
- **Pronto quando:** existe número, não impressão, e a escolha está registrada na spec.

### E5. Teto de custo de LLM por roteiro

- **Evidência:** `LLM_ROUTE_BUDGET_USD` não existe no código. Planilha de apoio em
  `docs/negocio/2026-08-31-custo-llm-por-roteiro.md`, proposta 0,60 pago / 0,15 grátis.
- **Bloqueado:** falta o felippebutland cravar o número.
- **Depende de E3** — sem preço certo o teto não mede nada.

### E6. `AdvisorChat.tsx` — warning de eslint

- **Evidência:** `packages/ui/src/AdvisorChat/AdvisorChat.tsx:26`, `Unused
  eslint-disable directive`.
- **Fazer:** apagar a diretiva. É uma linha.
- **Pronto quando:** `pnpm lint` sai sem warning nenhum.

### E7. Mutação da `apps/api` em ~94,6%

- Sobreviventes são equivalentes (`start === -1` vs `end <= start` em `extractJson*`) e
  strings de erro. Dentro do break de 90.
- **Fazer:** só reavaliar depois do Passo 8, que muda bastante o `apps/api`. Se cair
  abaixo de 90, aí sim vira trabalho.

---

## Bloco F — CI e ambiente

### F1. CI não é obrigatório pra merge na `main`

- **Evidência:** o Passo 7 entrou na `main` com typecheck vermelho e a aplicação sem
  subir. O `README.md` manda ligar branch protection e isso nunca foi ligado.
- **Fazer:** GitHub → Settings → Branches → exigir o job `check`.
- **É o item de maior retorno do plano inteiro.** Todo o resto desta lista existe
  porque este não existia.

### F2. Mutação no CI roda tudo — FEITO (2026-09-01)

- Era `pnpm test:mutation` dentro do job `check`, em série depois de tudo. Na primeira
  vez que o CI chegou lá, o dry run do Stryker em `apps/api` estourou o timeout default
  de 5 min.
- Agora: job `mutation` separado e **em paralelo** ao `check` (a espera do PR é o maior
  dos dois, não a soma), rodando `turbo run test:mutation --filter='...[origin/main]'` —
  só os pacotes tocados e quem depende deles. Mutação completa em
  `.github/workflows/nightly-mutation.yml` (cron 05:00 UTC, `timeout-minutes: 90`,
  relatório HTML como artifact).
- O gate não foi removido: o job `mutation` reprova o PR igual.
- **Limite conhecido:** PR que toca `packages/shared` arrasta todo mundo, porque todos
  dependem dele. Aí a mutação volta a ser completa — só em paralelo.
- `apps/api/stryker.config.json` ganhou `dryRunTimeoutMinutes: 15`, e o CI re-migra o
  banco antes da mutação (o `client.spec` de `@farol/db` dropa o schema durante
  `pnpm test` e nada recriava antes).

### F3. Banco de teste dedicado

- **Evidência:** hoje `DATABASE_URL_TEST` aponta pro mesmo banco de desenvolvimento.
  `packages/db/src/client.spec.ts` derruba tabelas, então `pnpm test` zera o banco local
  e exige `db:migrate` + `db:seed` de novo.
- **Fazer:** `docker-compose.yml` cria um `farol_test`; `DATABASE_URL_TEST` aponta pra
  ele; `.env.example` documenta.
- **Armadilha a manter documentada:** os specs fazem `DATABASE_URL_TEST ??
  DATABASE_URL`, e `??` **não** cai no fallback com string vazia. Variável definida e
  vazia quebra os testes com mensagem enganosa. Ou preenchida, ou comentada.

### F4. Envs do CI ainda são Amadeus

- `.github/workflows/ci.yml` declara `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`.
  Vira `TRAVELPAYOUTS_TOKEN` / `TRAVELPAYOUTS_MARKER` **no Passo 10**, não aqui.

### F5. Restrição de runtime a documentar

- `apps/api` compila pra CJS e importa pacotes ESM — isso é `require(esm)`, sem flag
  só no **Node ≥ 22.12**. O `engines` foi fixado em `">=22.12"` no fix de boot.
- **Fazer:** quando existir deploy, garantir a mesma versão mínima lá. Hoje não há
  Dockerfile nem config de deploy no repo, então não há o que corrigir — só não
  esquecer.

---

## Bloco G — Lição do fix de boot

O `apps/api` nunca tinha subido, com 334 testes e 44 e2e verdes, porque **toda a suíte
roda sob Vitest** — que resolve módulos pelo Vite e adivinha extensão de import, coisa
que o ESM do Node não faz. E o CI rodava lint, typecheck, test, e2e e mutação, mas
nunca `build` nem o processo.

Corrigido em `apps/api/test/boot-smoke.mjs` mais `pnpm build` e o smoke no CI.

**A generalizar:** teste que roda dentro do Vitest não prova que a aplicação sobe.
Qualquer novo processo executável (o `apps/worker` inclusive, hoje sem smoke próprio)
precisa de uma verificação no Node cru.

**FEITO (2026-09-01).** `apps/worker/test/boot-smoke.mjs` sobe `node dist/main.worker.js`
e espera `{"event":"worker_ready"}`; entrou no CI ao lado do smoke da api.

Pegou bug na primeira execução: `apps/api/package.json` exportava
`{ ".": "./src/worker-exports.ts" }` — TypeScript com import sem extensão, mesma classe
do fix de boot. **O `apps/worker` nunca subiu.** Passava por 2 testes verdes e pelo e2e
porque tudo roda sob Vitest. `exports` agora aponta para `dist/worker-exports.js`, com
`types` separado.

---

## Ordem sugerida

1. **F1** — ligar branch protection. Sem isso o resto volta a acontecer.
2. **D1** e **D2** — decisão antes do Passo 8.
3. Passo 8.
4. **E6**, **E2** — as duas linhas fáceis, junto de qualquer PR.
5. **E1**, **E3** → **E4** → **E5**.
6. **F3**, **G**. (F2 feito)
7. **E7** — reavaliar só depois do Passo 8.

## Definition of Done

Cada item fecha com os gates do projeto verdes (`build`, `typecheck`, `lint`, `test`,
`test:e2e`, `test:mutation`) e, quando tocar processo executável, com o smoke de boot
passando. Item bloqueado por decisão de produto (E5) fica registrado como bloqueado,
não como pendente.
