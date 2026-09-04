# Curadoria do catálogo de destinos

**Data:** 2026-09-03 · **Estado:** processo em uso, catálogo em 23 de ~200

## O problema

A descoberta só sugere o que está em `packages/db/data/destinations.csv`. São 23
cidades. Um destino fora dessa lista não existe para o Farol, por mais óbvio que
seja — Miami, Lima e Paris estavam de fora.

A tentação é resolver isso em tempo de requisição, consultando o
`/v1/city-directions` do Travelpayouts e jogando o resultado na tela. Não
funciona, e vale registrar por quê.

## Por que o city-directions não substitui o catálogo

Ele responde o seguinte, e só:

```json
{ "origin": "SAO", "destination": "MIA", "airline": "AA",
  "departure_at": "...", "price": 3806, "transfers": 1 }
```

O pré-filtro e o ranking precisam de outra coisa:

| Campo | Vem da API? | Para que serve |
|---|---|---|
| `avgFlightCostFromGru` | ✅ | orçamento |
| `city`, `country`, coordenada | ✅ (dumps `cities`/`countries`) | exibição, hotel |
| `tags` | ❌ | casar com o perfil de gosto |
| `bestMonths` | ❌ | descartar época ruim |
| `avgLodgingNight` | ❌ | estimativa de custo |
| `avgDailyLocal` | ❌ | estimativa de custo |
| `region`, `visaFreeBr` | ❌ | elegibilidade |

Sem `tags` e `bestMonths` o destino não pode ser pontuado por aderência — entraria
na lista sem saber se combina com quem está pedindo. Sem `avgLodgingNight` e
`avgDailyLocal` a estimativa de custo que aparece no cartão seria um chute
apresentado como número.

Deixar o LLM preencher esses campos foi considerado e recusado: seria o modelo
inventando preço de diária, e o resto do sistema é construído para não fazer isso
(ver o aviso de "preço aproximado" na tela de voo).

## O processo

O `city-directions` entra como **fonte de pesquisa**, fora do caminho da
requisição:

```bash
doppler run -- pnpm --filter @farol/db research:destinations
```

O script consulta 12 origens brasileiras (GRU, GIG, BSB, CNF, POA, REC, SSA, FOR,
CWB, VCP, BEL, MAO), cruza com os dumps de cidade e país, remove o que já está
catalogado e escreve `packages/db/data/destination-candidates.csv`.

A saída ordena por **alcance antes de preço**: um destino que sai de dez capitais
serve mais gente do que uma passagem barata a partir de uma só.

As colunas com `_` são evidência da API e não vão para o banco:

- `_origensQueVoam` — de quantas das 12 origens há voo
- `_precoMin`, `avgFlightCostFromGru` — menor tarifa e **mediana** (a mediana
  ignora a promoção isolada)
- `_mesesObservados` — em que meses havia tarifa em cache. **Não é `bestMonths`**:
  reflete a janela de cache do parceiro, não a estação boa do destino
- `_escalasMin`, `_lat`, `_lon`, `_countryCode`

As colunas em branco são a curadoria: `tags`, `bestMonths`, `avgLodgingNight`,
`avgDailyLocal`, `region`, `visaFreeBr`.

Preenchidas, as linhas entram no `destinations.csv` (sem as colunas `_`) e sobem
com `pnpm --filter @farol/db db:seed`.

## O que a rodada de 2026-09-03 mostrou

89 candidatos fora do catálogo. Os de maior alcance:

| Destino | Origens | Mediana | Escalas |
|---|---|---|---|
| Florianópolis | 9 | R$ 1.076 | direto |
| São Luís | 8 | R$ 1.261 | direto |
| Miami | 6 | R$ 3.806 | 1 |
| João Pessoa | 5 | R$ 1.479 | 1 |
| Lima | 4 | R$ 1.715 | direto |
| Paris | 4 | R$ 5.304 | 1 |
| Istambul | 4 | R$ 6.279 | 1 |
| Cidade do Panamá | 3 | R$ 3.077 | direto |
| Dubai | 3 | R$ 5.461 | 1 |

O candidato mais alcançado depois deles é Moscou (8 origens), que a curadoria
provavelmente descarta — 2 escalas, R$ 8.242 e sem apelo para o público do MVP.

## Cuidados

- O `destination-candidates.csv` **não é versionado**: os preços mudam a cada
  rodada e o diff seria ruído. O que se versiona é o `destinations.csv` curado.
- O dump `pt` do Travelpayouts usa português europeu ("Moscovo", "Assunção") e
  deixa `name` vazio em algumas cidades — o script cai para `name_translations`,
  mas o nome final é decisão da curadoria.
- `visaFreeBr` é dado jurídico e muda. Conferir na fonte antes de gravar.
- O `city-directions` devolve ~30 destinos por origem. Cobrir mais destinos
  significa mais origens, não mais chamadas na mesma.

## Relacionados

- `packages/db/scripts/research-destinations.mjs`
- `packages/domain/src/discovery/prefilter.ts` — o que cada campo faz
- `docs/negocio/2026-08-31-spec-migracao-travelpayouts.md`
