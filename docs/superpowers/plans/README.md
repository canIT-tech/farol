# Planos de implementação — Farol

Um plano por passo do backlog do `CLAUDE.md`. Cada plano é bite-sized (tasks TDD:
teste que falha → implementação → teste passa → mutação → commit) e cobre a
**Definition of Done** do projeto (cobertura 100% por pacote + unidade/integração/e2e/mutação).

## Planos

| Passo | Plano | Arquivo | Depende de |
|---|---|---|---|
| 1 | Fundação do monorepo | `2026-08-28-fundacao-monorepo.md` | — |
| 2 | Auth + Perfil de gosto | `2026-08-28-auth-perfil.md` | 1 |
| 3 | Viagens + Descoberta de destino | `2026-08-28-viagens-descoberta.md` | 2 |
| 4 | Roteiro + Jobs (pg-boss) | `2026-08-28-roteiro-jobs.md` | 3 |
| 5 | Providers Amadeus (voo + hotel) | `2026-08-28-providers-amadeus.md` | 3 |
| 6 | Google Places + enrich | `2026-08-28-places-enrich.md` | 4, 5 |
| 7 | Chat IA (tool-calling) | `2026-08-28-chat-ia.md` | 4, 5, 6 |
| 8 | UI web + E2E | `2026-08-28-ui-web-e2e.md` | 7, 9 |
| 9 | `packages/ui` | `2026-08-28-packages-ui.md` | 1 |

## Paralelismo

```
1 ──┬── 2 ── 3 ──┬── 4 ──┐
    │             └── 5 ──┼── 6 ── 7 ── 8
    └── 9 ────────────────────────────┘
```

- **9** pode ser puxado logo após o **1**.
- **4** e **5** podem ser puxados em paralelo depois do **3**.
- **8** é o último — precisa do **7** e do **9**.

## Regra

Antes de implementar qualquer passo, "puxar o passo N" (guideline do `CLAUDE.md`):
commit de claim na `main` → branch `<nome>/passo-N-<slug>` → executar as tasks em ordem.
Os planos foram escritos com o contexto atual; se ao puxar um passo o anterior tiver
mudado alguma decisão, ajustar o plano no início da branch antes de executar.
