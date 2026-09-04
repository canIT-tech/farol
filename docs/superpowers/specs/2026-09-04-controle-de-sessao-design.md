# Controle de sessão — endurecimento

**Data:** 2026-09-04 · **Status:** implementado · **Branch:** `felippebutland/layout-telas-app`

## O que estava frouxo

Levantamento feito contra o sistema rodando, não por leitura.

**Duas suspeitas não se confirmaram** e ficam registradas para ninguém refazer o
caminho: a chave anônima pública do Supabase é HS256 e o JWKS do projeto é
ES256, então ela não passa no guard; e token ausente, malformado ou inválido já
devolviam 401 corretamente.

O que era real:

1. **A sessão do web congelava no minuto zero.** O `AuthGate` lia `getSession()`
   uma vez na montagem e passava aquele `access_token` adiante para sempre.
   Ninguém escutava `onAuthStateChange`. O Supabase renova o token em segundo
   plano, mas o app seguia com o antigo: passada a validade, toda chamada dava
   401 e a pessoa via erro cru, sem caminho de volta. Sair em outra aba também
   não afetava a aba aberta.
2. **Nada tratava 401.** O `ApiError` já carregava `status` e ninguém olhava.
3. **Guard era opt-in.** Cada controller precisava lembrar do `@UseGuards`.
   Esquecer publicava a rota em silêncio — e `/geo` estava assim, aberto,
   gastando cota do Travelpayouts para qualquer um (`/geo/whereami` consulta o
   provider a cada chamada).
4. **`app.enableCors()` sem argumento** = `origin: *`.
5. **`jwtVerify` sem `audience`.**

## Decisões

### A api continua stateless

Revogação imediata de access token exigiria consultar uma lista de revogados a
cada request — banco ou Redis em toda rota autenticada, latência e mais um ponto
de falha. Fica de fora. O logout revoga o *refresh token* no servidor (o
`signOut()` do supabase-js já faz), e a janela do access token se fecha
encurtando a validade no painel do Supabase: **1h → 15min**.

Consequência aceita: entre o logout e o `exp`, um token já emitido continua
valendo.

### Protegido por padrão

`AuthGuard` virou `APP_GUARD` global; abrir uma rota agora é um `@Public()`
explícito. Os oito `@UseGuards(AuthGuard)` saíram por redundância.

A inversão é o ponto: antes, esquecer abria; agora, esquecer fecha. Abrir vira
uma linha visível no diff.

Públicos: `health` e `waitlist` (a landing existe antes de haver conta).
`/geo` passou a exigir credencial — os dois consumidores (`OriginField` no
`/auto` e no `/trips/new`) já rodavam atrás do `AuthGate`, então o comentário
que dizia "roda antes do login" estava errado.

### `audience` sim, `issuer` não

O JWKS traz só a chave deste projeto: token de outro emissor já falha na
assinatura. Verificar `issuer` não acrescentaria segurança, e acrescentaria uma
forma de derrubar todo o login se o valor esperado divergisse do emitido — não
havia como confirmar contra um token real sem criar usuário no projeto.

`audience` é diferente: rejeita token do mesmo projeto que não represente uma
pessoa logada. `SUPABASE_JWT_AUD`, default `authenticated`; vazio desliga.

### CORS fechado em produção

Em produção a api e o web são o mesmo processo e a mesma origem
(`SERVE_WEB=true`, `NEXT_PUBLIC_API_URL=/api`, caminho relativo): **nenhuma
requisição cross-origin é legítima**. O `render.yaml` zera `CORS_ORIGINS`.

O default do schema (`localhost:3000,localhost:3100`) existe só para o
desenvolvimento, onde a chamada é mesmo cross-origin. `credentials: false`
sempre — a credencial viaja no header `Authorization`, não em cookie, e aceitar
cookie de outra origem abriria CSRF sem ganhar nada.

### Inatividade: 30 minutos

`useIdleTimer` escuta `pointerdown`, `keydown` e `visibilitychange`; o silêncio
prolongado chama `signOut()`, que emite `SIGNED_OUT` e cai no redirecionamento
que já existe — um caminho só para sair, venha o fim da sessão de onde vier.

**O que isto protege:** tela deixada aberta, máquina compartilhada. **O que não
protege:** token roubado — a api é stateless e não sabe de inatividade. Quem
fecha aquela janela é a validade curta do token.

### Backstop de 401

Com a renovação funcionando, um 401 passou a significar sessão morta de verdade
(relógio fora de sincronia, JWKS rotacionado, conta apagada). O `api-client`
dispara um `CustomEvent("farol:unauthorized")` e o `AuthGate` reconsulta antes de
decidir — 401 passageiro não derruba quem ainda está logado.

Evento de DOM em vez de handler global no módulo: não deixa estado pendurado
entre testes e não amarra o `api-client` a quem reage. Só o 401 dispara; 403 é
"essa viagem é de outra pessoa" e 5xx é problema nosso.

## Fora do código

Baixar o JWT expiry no painel do Supabase para 900s (Authentication → Sessions).
Sem isso, o item que fecha a janela do logout não existe.
