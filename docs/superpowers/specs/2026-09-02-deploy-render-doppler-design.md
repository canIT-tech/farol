# Deploy do Farol — serviço único no Render, credenciais no Doppler

Design de deploy e de gestão de credenciais. Decidido em 2026-09-02.

## Objetivo

Farol em produção hoje, no free tier, sem que credencial passe por chat, por
`.env` mantido à mão, ou por copiar e colar. Não é lançamento aberto: é ambiente
de teste e validação, sem usuários.

## Topologia

Um Web Service no Render, um processo, free tier.

```
Render      farol  (web service, free)
              /api/*   NestJS
              /*       Next.js
              handlers do pg-boss no mesmo processo
Supabase    vvmnkqgdtgvdhheoqvjt  — postgres + auth
Groq        openai/gpt-oss-120b (capable) · openai/gpt-oss-20b (cheap)
Doppler     cofre de credenciais
```

**`apps/worker` não é deployado.** O free tier do Render não tem Background Worker.
Os handlers rodam dentro da API com `RUN_JOB_HANDLERS=true`, e o Next é servido pelo
mesmo processo com `SERVE_WEB=true` — as duas flags já existem e estão desligadas por
padrão, então desenvolvimento continua com web e worker separados.

O prefixo `/api` não é cosmético: sem ele `GET /trips/:id` (rota da api) colide com
`/trips/[id]/...` (página do Next).

### Alternativas descartadas

| Opção | Por que não |
|---|---|
| Web no Vercel + api no Render | Dois serviços, duas credenciais, e desfaz o serviço único já validado. Ganho real seria a landing não dormir |
| Fly, tudo num container | Sem free tier desde 2024, e exige Dockerfile mais supervisor |
| Export estático do web servido pelo Nest | `output: "export"` exige `generateStaticParams` em `trips/[id]`, que é dinâmica por natureza |
| Projeto Supabase novo e isolado | Decisão do dono: reusar o existente. Ressalva registrada abaixo |

## Credenciais — Doppler no centro

O problema que isto resolve: hoje a mesma credencial vive no `.env` local, no
`.env.example` como placeholder, nas envs do CI e nas envs da plataforma. Quatro
lugares, nenhum autoritativo.

### Fluxo

```
Doppler  (projeto farol, config prd)
   │
   ├─ doppler run -- pnpm dev        desenvolvimento, sem arquivo .env
   ├─ MCP do Doppler                 eu leio no deploy e escrevo no Render
   └─ gh secret set                  CI, quando precisar
```

**Doppler é a única fonte de verdade.** Todo outro lugar é destino, e destino é
sempre escrito a partir do Doppler, nunca editado à mão.

### O que o Doppler guarda

| Nome | Origem primária |
|---|---|
| `DATABASE_URL` | Supabase (MCP) |
| `SUPABASE_JWKS_URL` | derivado do project ref |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (MCP) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (MCP) |
| `LLM_API_KEY` | console da Groq — sem MCP |
| `GOOGLE_PLACES_KEY` | console do Google — sem MCP |

### O que não vai para o cofre

Configuração não é segredo. Fica literal no `render.yaml`, versionada e revisável:
`SERVE_WEB`, `RUN_JOB_HANDLERS`, `NEXT_PUBLIC_API_URL=/api`, `JOBS_SCHEMA`,
`NODE_VERSION`, os `*_CACHE_TTL_SECONDS`, os `*_DEEPLINK_TEMPLATE`, e os
`AMADEUS_*` como placeholder (o provider foi descontinuado; voo e hotel degradam
para `error: "unavailable"` sem derrubar a api).

Misturar segredo e configuração no cofre é o que faz ninguém saber mais o que é
sensível.

### Sem depender de sync

O free tier do Doppler dá **5 config syncs**. Com um app novo por semana, isso
esgota em três semanas. Então o desenho **não usa sync**: eu leio do Doppler por MCP
e escrevo nas envs do Render. Sync fica disponível como conveniência futura, não como
dependência.

### Bootstrap — o ovo e a galinha

Um cofre precisa de uma chave para abrir, e essa chave não pode morar nele. É
irredutível. A sequência mínima, feita uma vez:

1. Conta no Doppler, projeto `farol`, config `prd`
2. `brew install dopplerhq/cli/doppler` e `doppler login` (OAuth no browser)
3. Service token do projeto, colocado na config do MCP do Doppler

O passo 3 é o único segredo que o dono manuseia à mão, uma vez. Depois disso
nenhuma credencial precisa ser digitada, colada ou lida por humano.

## Migration e seed

**Fora do `buildCommand`.** O banco é compartilhado com o felippebutland, e deploy
automático que migra banco de outra pessoa é risco sem ganho. `buildCommand` fica:

```
corepack enable && pnpm install --frozen-lockfile && pnpm build
```

Migration roda por MCP, com autorização explícita, uma vez agora e depois só quando o
schema mudar.

### Ressalva registrada

Reusar `vvmnkqgdtgvdhheoqvjt` significa que produção e desenvolvimento compartilham
banco. Duas consequências que o dono aceitou:

- `pnpm test` com `DATABASE_URL_TEST` mal configurada atinge produção — o
  `client.spec` de `@farol/db` dropa o schema `public` inteiro
- dados de teste e de produção convivem

Mitigação existente: `DATABASE_URL_TEST` aponta para `farol_test`, um banco separado
criado pelo `docker-compose.yml`. A proteção é essa variável estar certa.

## Conexão com o Postgres

Tentar **direta** primeiro. Se der `getaddrinfo ENOTFOUND`, cair no **Session
pooler** — a Supabase aposentou IPv4 na conexão direta, e o erro parece typo em vez
de problema de família de endereço.

Nunca o Transaction pooler na 6543: é pgbouncer em modo transação, que quebra
prepared statement e estado de sessão, e o pg-boss depende dos dois.

## Verificação

Deploy não é "a API retornou 200 para a minha chamada".

1. `GET /api/health` na URL pública, **lendo o corpo**, com `checks.db` em `up`
2. `GET /` renderiza a landing, e o contador da waitlist vem da api pela mesma origem
3. `list_logs` do Render sem erro de boot — um serviço pode reportar live e estar em
   crash loop
4. Redirect URL da Supabase apontando para o domínio do Render, senão o magic link
   volta para a origem errada e o login parece quebrado sem erro

Qualquer item que falhe é reportado como falha. Deploy parcial não é deploy.

## Fora de escopo

- **Stripe.** Decisão do dono: não agora.
- **Vercel.** A topologia escolhida não usa.
- **Sentry.** O repo não tem `@sentry/*`. Consequência aceita: a primeira falha em
  produção é invisível. Adicionar é decisão separada.
- **Domínio próprio.** `farolviagens.com` ainda não foi registrado; produção usa o
  subdomínio `onrender.com`.
- **Passo 10 (Travelpayouts) e Passo 11 (pagamento).** Voo e hotel sobem como seção
  degradada.

## Limites que valem saber

| Limite | Efeito |
|---|---|
| Render free dorme após 15 min | cold start acima de 30 s; consumidor de fila parado enquanto dorme |
| Render free sem Background Worker | por isso os handlers vivem na api |
| Doppler free: 3 pessoas, 10 projetos, 5 syncs | o desenho não usa sync; 3 pessoas cobre o time atual |
| Groq free: 30 RPM, 1000 RPD, 8000 TPM, 200k TPD | pelo uso medido, ~43 roteiros por dia |

## Pendências para o dono

1. Autorizar o MCP do Render — hoje responde `unauthorized`
2. Criar a conta e o projeto no Doppler, e pôr o service token na config do MCP
3. Confirmar que a anon key existe no projeto Supabase (eu leio por MCP)
4. Autorizar a migration no banco compartilhado
