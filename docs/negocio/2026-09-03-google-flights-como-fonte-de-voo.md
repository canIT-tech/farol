# Google Flights como fonte primária de oferta de voo

**Data:** 2026-09-03 · **Status:** implementado · **Branch:** `felippebutland/layout-telas-app`

## Por que

O Travelpayouts não faz busca ao vivo. O que ele devolve é **cache do parceiro**:
a tarifa que alguém encontrou naquela rota há horas ou dias. A UI foi obrigada a
dizer "preço aproximado" em toda parte, e o assessor não consegue afirmar horário
de partida nem número de voo. Busca ao vivo pela Aviasales Search API exige
50 mil usuários únicos por mês — um requisito que o Farol não vai cumprir tão
cedo.

O Google Flights tem preço e horário reais, de graça, sem cadastro.

## O que foi feito

Um provider que lê a página pública do Google Flights, no espírito do
[`AWeirdDev/flights`](https://github.com/AWeirdDev/flights) (Python), reescrito
em TypeScript para o monorepo. `packages/providers/src/googleflights/`.

A busca vai num parâmetro `tfs`: uma mensagem protobuf serializada em base64.
A resposta vem num `<script class="ds:1">` da página, num array posicional sem
nomes de campo. Descoberta original do formato por @kftang.

### Duas coisas que fizemos diferente do fast-flights

**Lemos as duas listas de ofertas.** O Google devolve "melhores voos" em
`payload[3][0]` e "outros voos" em `payload[2][0]`. O fast-flights lê só a
primeira — e a segunda costuma ter a mais barata. Em GRU→LIS, 15/11/2026: ele
acharia R$ 2.562, nós achamos R$ 1.997.

**Não impersonamos TLS.** O fast-flights usa `primp` com
`impersonate="chrome_145"`, que forja a impressão digital de TLS. Não existe
equivalente em Node, e testamos que não precisa: `fetch` puro com três
cabeçalhos de browser recebe a página completa.

### Sem dependência nova

O protobuf é codificado à mão (`tfs.ts`, ~50 linhas de varint). O `ds:1` sai por
regex. Trazer `protobufjs` para escrever 40 bytes, ou `cheerio` para achar uma
tag por classe exata, seria peso morto num pacote sem nenhuma dependência de
parsing.

## Decisões

### O deep link aponta para o Google, não para o afiliado

O `marker` do Travelpayouts rende comissão; o Google Flights não tem programa de
afiliado. A tentação é mostrar o preço do Google e mandar a pessoa para o
Aviasales.

Não fazemos isso. Mandar alguém para um destino com um preço que veio de outro
lugar é vender um número que o destino pode não honrar — e a voz da marca é
"honesto sobre incerteza". A oferta do Google leva ao Google, com a mesma URL
`tfs` que produziu aquele preço. As ofertas do fallback mantêm o `marker`.

**Custo:** perde-se a comissão nas ofertas que vêm do Google. Trade deliberado.
Reverter é mudar uma linha em `normalize-flight.ts`.

### Sempre atrás de um fallback

`FallbackFlightProvider` compõe as duas fontes: ofertas do Google, caindo no
Travelpayouts se ele falhar; insights ("quando ir", "melhor dia", aeroportos
vizinhos) sempre do Travelpayouts, que tem endpoints próprios para isso.

Lista vazia **não** dispara o fallback. "Essa rota não tem voo nessa data" é uma
resposta correta, e substituí-la por cache do parceiro inventaria oferta para
uma rota que não voa.

`GOOGLE_FLIGHTS_ENABLED=false` volta ao comportamento anterior.

### Ida e volta traz só a ida

Na busca de ida e volta o Google devolve o preço **total** mas só o itinerário de
ida — a volta aparece depois que a pessoa escolhe a ida. O `returnAt` fica nulo.
Inventar um horário ali seria pior que não ter.

### O que o Google chama de "calendário de preço" não é o nosso

`payload[5]` traz preço mais baixo, típico, faixa e uma série histórica — mas a
data que varia é a da **compra** ("está R$ 44 abaixo do normal"), não a da
partida. O calendário por data de partida (`RoutePriceSample`) segue vindo do
Travelpayouts. Obtê-lo do Google exigiria uma busca por dia.

Exposto como `FlightPriceContext` em `@farol/shared`.

## Riscos

**Isto é scraping.** Fere os Termos de Serviço do Google, não tem SLA, e o
formato é posicional — `single_flight[20]` é a data de partida. Uma mudança de
layout quebra o parser sem aviso.

As três defesas:

1. **`FallbackFlightProvider`** — quebrou, cai no Travelpayouts, a tela não fica vazia.
2. **Circuit breaker** — sequência de falhas para de bater no Google, o que evita
   virar bloqueio por volume.
3. **`.github/workflows/nightly-google-flights.yml`** — busca real 1×/dia. É a
   única coisa que prova que ainda funciona: as fixtures congelam o layout do dia
   em que foram gravadas, então um CI verde não prova nada sobre a busca real.

Consertar: `pnpm --filter @farol/providers record:google-flights` regrava as
fixtures, e os specs de `normalize-flight` apontam o que mudou.

## Verificação

Contra a API real, GRU→LIS, 60 dias à frente:

```
ofertas: 8
  BRL 1937  Air Europa  15:05→06:50  1 escala(s)  765 min
  BRL 1997  LATAM       17:40→06:20  0 escala(s)  580 min
contexto de preço: mais barato 1937, típico 1954, faixa 1900–2100, 61 pontos
```

`@farol/providers`: 281 testes, cobertura 100%, mutação 94,92 (pasta
`googleflights` 93,55).
