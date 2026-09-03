# Opções de provider de hotel — sem o Farol virar canal de reserva

- **Status:** análise para decisão · nada implementado a partir daqui
- **Data:** 2026-09-03
- **Dono (produto):** felippe
- **Contexto anterior:** `docs/negocio/2026-08-31-spec-migracao-travelpayouts.md` §11 e §12
- **Código hoje:** `packages/providers/src/liteapi/` (LiteAPI implementada e funcionando)

---

## 1. Por que esta análise existe

Hotel ficou sem fonte quando o **Hotellook foi encerrado em 20/10/2025** (marca, programa
de afiliado e API). A **LiteAPI (Nuitée)** entrou no lugar e está implementada: conteúdo e
tarifa, os dois gratuitos, cartão do hi-fi completo.

Só que a LiteAPI é uma **API de reserva**. Usar a tarifa dela com seriedade implica que a
reserva de hotel acontece dentro do Farol. Esta análise responde: **existe outra fonte que
dê preço de hotel sem essa amarra?**

## 2. O que "virar canal de reserva" significa na prática

Não é um detalhe técnico. É:

- **Cartão cadastrado e carteira financiada** no painel da Nuitée para liberar a chave de
  produção. Hoje usamos a chave de sandbox, que dá conteúdo real e tarifa de teste.
- **O Farol passa a ser o comerciante** da diária: o dinheiro do hóspede entra por nós.
- **Suporte, cancelamento e no-show** viram nosso problema operacional, não do parceiro.
- Em compensação, a receita é **margem** (você define), o que rende mais que comissão de
  afiliado.

O lado de voo **não** tem isso: o Travelpayouts é deep-link com `marker`, o clique sai e a
comissão cai no painel. A pergunta é se hotel pode seguir o mesmo formato.

## 3. As opções verificadas

Todas checadas em 2026-09-03.

| Opção | Diária em R$ | Nome / nota / foto / geo | Custo | Rende comissão | Vira canal de reserva |
|---|---|---|---|---|---|
| **LiteAPI — conteúdo** (`GET /data/hotels`) | ❌ | ✅ | grátis, sem contrapartida | ❌ | ❌ |
| **LiteAPI — tarifa** (`POST /hotels/min-rates`) | ✅ | — | grátis, mas a ToS espera *look-to-book* razoável | ✅ margem | ✅ |
| **SerpApi Google Hotels** | ✅ | ✅ | 250 buscas/mês grátis, depois US$ 25/1.000 | ❌ | ❌ |
| **TripAdvisor Content API** | ❌ — preço é outra API, liberada por e-mail | ✅ | 5.000 chamadas/mês grátis, **exige cartão** | ❌ | ❌ |
| **Google Places** (já integrado) | ❌ — só faixa `$$` | ✅ | já pagamos por request | ❌ | ❌ |
| **Afiliado Travelpayouts** (Booking.com, Agoda, Trip.com) | ❌ | ❌ | grátis | ✅ comissão | ❌ |

**Nenhuma linha sozinha fecha o cartão do hi-fi.** O cartão pede foto, nome, bairro, nota e
`R$ 320 /noite`. Só a LiteAPI completa entrega tudo de uma fonte; qualquer alternativa é
**dado de uma + link de saída de outra**.

Descartadas por contrato: **Hotelbeds**, **RateHawk** e **Amadeus Enterprise** — todas
exigem contrato comercial para produção, e a Amadeus é justamente o custo do qual saímos.

## 4. Os três cenários possíveis

### A. LiteAPI (conteúdo) + SerpApi (preço)

Cartão completo, sem obrigação de reservar.

- **Muda pouco código.** O `LiteApiHotelProvider` já faz as duas chamadas separadas —
  conteúdo e tarifa. Trocar a fonte do preço é um arquivo.
- **Custo:** grátis até 250 buscas/mês. Com o cache de 1 h por cidade + datas, um MVP
  pré-lançamento cabe. Acima disso, US$ 25 por 1.000.
- **Não rende nada** por si; a comissão dependeria de um link de afiliado (ver §5).

### B. Só conteúdo, sem diária

- LiteAPI conteúdo (grátis, sem contrapartida nenhuma). O cartão mostra foto, nome,
  bairro, nota e "N paradas a pé", e no lugar do valor vai **"ver preço no parceiro"**.
- **Zero custo, zero conta nova, zero decisão comercial.**
- O campo de preço do hi-fi fica vazio — é a única perda, e é visível.

### C. Manter a LiteAPI como está

- Nada muda. Cartão completo, tudo gratuito, sandbox funcionando para desenvolver e
  demonstrar. A decisão de canal fica para quando for a produção de verdade.

## 5. Duas coisas que precisam ser confirmadas por quem tem as contas

1. **Link de afiliado por hotel específico.** Os programas de hotel do Travelpayouts
   (Booking.com, Agoda, Trip.com) historicamente entregam link de **busca**, não de hotel.
   Se a comissão de hotel importa no MVP, isso muda qual cenário compensa — e precisa ser
   verificado no painel antes de implementar. Não dá para prometer receita nesse formato
   sem checar.
2. **SerpApi raspa o Google.** Eles assumem a responsabilidade legal comercialmente, mas é
   um fornecedor a mais na cadeia, entregando dado de terceiro sobre terceiro. Vale a
   leitura da ToS antes de depender disso em produção.

## 6. Recomendação

**Cenário C até o lançamento; decidir entre A e B quando houver tráfego real.**

Razão: hoje nada está bloqueado. O sandbox da LiteAPI entrega conteúdo real e o cartão do
hi-fi está completo — dá para desenvolver, demonstrar e validar o produto inteiro sem
gastar nada e sem assumir compromisso nenhum. As opções A e B só passam a valer quando a
pergunta "quem é o canal de reserva" tiver consequência de verdade, e aí a resposta da §5.1
já vai existir.

O que **não** deveria acontecer é ir para produção com a tarifa da LiteAPI sem decidir
conscientemente virar canal de reserva — porque isso vem com cartão, carteira e suporte.

## 7. Estado do código

Nada aqui está implementado além do que já existe. Hoje:

- `packages/providers/src/liteapi/liteapi-hotel-provider.ts` — conteúdo + tarifa
- `apps/api/src/hotels/hotels.service.ts` — resolve país e coordenada e chama o provider
- `packages/ui/src/HotelOfferCard/` — o cartão do hi-fi
- Env: `LITEAPI_KEY` (sandbox), `LITEAPI_BASE_URL`, `LITEAPI_CURRENCY`,
  `LITEAPI_GUEST_NATIONALITY`, `HOTEL_SEARCH_RADIUS_METERS`

Trocar para o cenário A ou B mexe só na origem do preço, dentro do provider.

## 8. Fontes

- [FAQ do encerramento do Hotellook](https://support.travelpayouts.com/hc/en-us/articles/29534131568530-FAQ-on-the-closure-of-Hotellook)
- [LiteAPI — custos por endpoint](https://docs.liteapi.travel/reference/api-pricing-usage-costs)
- [LiteAPI — FAQ (sandbox vs produção)](https://docs.liteapi.travel/docs/faq)
- [SerpApi — Google Hotels API](https://serpapi.com/google-hotels-api) · [preços](https://serpapi.com/pricing)
- [TripAdvisor Content API](https://tripadvisor-content-api.readme.io/reference/faq)
