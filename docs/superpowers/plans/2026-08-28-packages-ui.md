# packages/ui — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar `packages/ui` — os tokens de `docs/design-system.md` (tema claro/escuro via `data-theme`) e os componentes base (`Button`, `TextField` + Stepper/Slider, `Chip`, `MatchBadge` + `MatchBar`, `DestinationCard`, `AppShell`, `StepNav`, `AdvisorChat`) + o set de ícones — todos testados (unidade + mutação), 100% de cobertura, prontos para o `apps/web`.

**Architecture:** Pacote React sem framework, exportando componentes e tokens. Tokens como CSS custom properties num arquivo global + um `ThemeProvider` fino que só troca `data-theme`. Componentes sem estado de servidor, estilizados com CSS Modules (ou vanilla-extract — decidir na Task 1), consumindo só os tokens. Cada componente é uma pasta: `Componente.tsx` + `Componente.module.css` + `Componente.stories.tsx` + `Componente.spec.tsx`. Overlays (menus/popover) usam Radix (pendência DS1 do `CLAUDE.md`), mas nenhum componente deste plano precisa de overlay — Radix entra depois.

**Tech Stack:** herda do Plano 1. Novo: `react`, `react-dom`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`; opcional `@vanilla-extract/css`.

**Spec:** `docs/design-system.md` (fonte da verdade dos tokens e das specs de componente). Referência visual: os `*.dc.html` na raiz do repo.

## Global Constraints

- Herdam do Plano 1 (pnpm, Node 22, cobertura 100% por pacote, mutação ≥ 90%, TDD, `@farol/*`, PT-BR nos comentários, DoD = testes completos).
- **Nenhum valor cromático/espacial/tipográfico hard-coded** — tudo via `var(--token)`. Um teste de guarda varre os `*.module.css` procurando hex/px fora da lista permitida e falha se achar.
- **Vitest com `environment: "jsdom"`** + `@testing-library/react`. `coverage.include = ["src/**/*.tsx", "src/**/*.ts"]`, exclui `*.stories.tsx`, `src/index.ts`, `src/tokens/*.css`.
- **Acessibilidade:** todo controle interativo com role/aria correto; `Button` foca via teclado; alvo ≥ 44px em `md`. Um teste por componente cobre foco/teclado.
- **Sem dependência do `apps/web`** — `packages/ui` é folha (depende só de `react`).
- **Stories** são para o Storybook do `apps/web` mais tarde; aqui servem de documentação viva e não contam na cobertura.
- **Componentes controlados** (valor + `onChange`), sem estado interno escondido além de UI puramente visual (hover é CSS).

---

### Task 1: Tokens + `ThemeProvider` + guarda de tokens

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts`, `packages/ui/vitest.setup.ts`, `packages/ui/src/tokens/tokens.css`, `packages/ui/src/tokens/tokens.ts`, `packages/ui/src/theme/ThemeProvider.tsx`, `packages/ui/src/index.ts`, `packages/ui/stryker.config.json`
- Create: `packages/ui/test/no-magic-values.spec.ts`
- Test: `packages/ui/src/theme/ThemeProvider.spec.tsx`

**Interfaces:**
- Produces:
  - `tokens.css` — `:root { ... }` com **todos** os tokens de `docs/design-system.md §2` (cor claro, tipografia, espaçamento, raio, elevação, movimento, control-h, shell); `[data-theme="dark"] { ... }` com o conjunto escuro.
  - `tokens.ts` — os mesmos nomes exportados como constantes string (`token.accent === "var(--accent)"`) para uso em TS quando necessário.
  - `ThemeProvider({ theme?: "light" | "dark" | "system"; children })` — seta `data-theme` no `document.documentElement` (ou num wrapper para testes); `system` remove o atributo (cai no `prefers-color-scheme`).
  - `useTheme()` → `{ theme, setTheme }`.

- [ ] **Step 1: Testes (falham)**
  - `ThemeProvider`: `theme="dark"` põe `data-theme="dark"`; `system` remove; `setTheme` alterna.
  - `no-magic-values.spec.ts`: lê todos os `src/**/*.module.css`; regex por `#[0-9a-f]{3,8}` e por `\d+px` fora de `var(--...)` e de uma allowlist (`0`, `1px` de borda, `100%`, `50%`); espera zero ocorrências. Nesta task ainda não há `.module.css` de componente — o teste passa vazio e trava a régua para as próximas.
- [ ] **Step 2: Run — falha.** `pnpm --filter @farol/ui vitest run`
- [ ] **Step 3: Implementar.** Decidir CSS Modules vs vanilla-extract e registrar a decisão num comentário no topo de `tokens.ts` (DS2 do `CLAUDE.md`). `vitest.setup.ts` importa `tokens.css` e registra `@testing-library/jest-dom`.
- [ ] **Step 4: Run — passa (100%).**
- [ ] **Step 5: Commit** — `feat(ui): tokens de design (claro/escuro), ThemeProvider e guarda de valores mágicos`

---

### Task 2: `Button`

**Files:**
- Create: `packages/ui/src/Button/Button.tsx`, `Button.module.css`, `Button.stories.tsx`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/Button/Button.spec.tsx`

**Interfaces:** (de `docs/design-system.md §3.1`)
- `type ButtonProps = { variant?: "primary" | "ghost" | "text"; size?: "sm" | "md" | "lg"; iconStart?: IconName; iconEnd?: IconName; loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>`
- `primary` default; `md` default; `loading` troca conteúdo por spinner 16px, mantém largura, `aria-busy`; `disabled` sem interação; foco via `box-shadow: var(--ring)`.

- [ ] **Step 1: Testes (falham)** — renderiza o texto; `onClick` dispara; `disabled` não dispara `onClick`; `loading` → `aria-busy="true"` e `onClick` bloqueado; `variant`/`size` aplicam a classe certa; foco por `Tab` deixa o botão como `document.activeElement`; `iconStart` renderiza o ícone antes do label.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.** Ícones: aceitar `IconName` do set (Task 9) — nesta ordem de execução, se o set ainda não existir, aceitar `ReactNode` e trocar para `IconName` quando a Task 9 entrar (anotar).
- [ ] **Step 4: Run — passa (100%) + mutação.**
- [ ] **Step 5: Commit** — `feat(ui): Button (primary/ghost/text, sm/md/lg, loading)`

---

### Task 3: `TextField` + `Stepper` + `Slider`

**Files:**
- Create: `packages/ui/src/TextField/{TextField.tsx,TextField.module.css,TextField.stories.tsx}`, `packages/ui/src/Stepper/*`, `packages/ui/src/Slider/*`
- Test: `TextField.spec.tsx`, `Stepper.spec.tsx`, `Slider.spec.tsx`

**Interfaces:** (`docs/design-system.md §3.2`)
- `TextFieldProps = { label: string; value: string; onChange: (v: string) => void; iconStart?: IconName; placeholder?: string; error?: string; hint?: string; disabled?: boolean }` — `error` presente → estado de erro + texto em `--accent-ink`; foco → borda `--accent` + `--ring`; `label` sempre associado por `htmlFor`/`id`.
- `StepperProps = { label: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }` — botões `–`/`+` com `aria-label`.
- `SliderProps = { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; formatValue?: (n: number) => string }` — `role="slider"` com `aria-valuemin/max/now`; setas do teclado ajustam.

- [ ] **Step 1: Testes (falham)** — `TextField`: digitar chama `onChange` com o valor; `error` renderiza a mensagem e marca `aria-invalid`; `label` clicável foca o input. `Stepper`: `+`/`–` respeitam `min`/`max`; teclado nos botões. `Slider`: `ArrowRight` incrementa `step`; respeita limites; `formatValue` aplicado no texto visível.
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Run — passa (100%) + mutação.**
- [ ] **Step 5: Commit** — `feat(ui): TextField, Stepper e Slider`

---

### Task 4: `Chip`

**Files:** `packages/ui/src/Chip/{Chip.tsx,Chip.module.css,Chip.stories.tsx}`, `Chip.spec.tsx`

**Interfaces:** (`§3.3`)
- `ChipProps = { children: React.ReactNode; selected?: boolean; tone?: "filter" | "taste"; onClick?: () => void }` — sem `onClick` = informativo (sem hover, sem role de botão); com `onClick` = `role="button"` + `aria-pressed={selected}`.

- [ ] **Step 1: Testes (falham)** — `selected` + `tone` aplicam classe; clicável tem `aria-pressed`; sem `onClick` não tem role; `onClick` dispara no clique e no `Enter`.
- [ ] **Steps 2–4:** implementar; 100% + mutação.
- [ ] **Step 5: Commit** — `feat(ui): Chip (filter/taste, selecionável ou informativo)`

---

### Task 5: `MatchBadge` + `MatchBar`

**Files:** `packages/ui/src/Match/{MatchBadge.tsx,MatchBar.tsx,Match.module.css,Match.stories.tsx}`, `Match.spec.tsx`

**Interfaces:** (`§3.4`)
- `MatchBadgeProps = { value: number }` (0–100) — pílula, ponto `--positive`, texto `--positive-ink`, `aria-label="{value}% de aderência"`.
- `MatchBarProps = { value: number }` — barra 4px, preenchimento proporcional, `role="progressbar"` com `aria-valuenow`.

- [ ] **Step 1: Testes (falham)** — `value` fora de 0–100 é clampado; `MatchBar` largura de preenchimento = `value%`; `aria` correto; único uso de `--positive` (verificado pela guarda da Task 1).
- [ ] **Steps 2–4:** implementar; 100% + mutação.
- [ ] **Step 5: Commit** — `feat(ui): MatchBadge e MatchBar`

---

### Task 6: `DestinationCard`

**Files:** `packages/ui/src/DestinationCard/{DestinationCard.tsx,DestinationCard.module.css,DestinationCard.stories.tsx}`, `DestinationCard.spec.tsx`

**Interfaces:** (`§3.5`, referência `Main.dc.html`)
- `DestinationCardProps = { city: string; country: string; matchValue: number; rationale: string; photoUrl?: string | null; stats: { label: string; value: string }[]; featured?: boolean; onSeeItinerary: () => void; onToggleSave: () => void; saved?: boolean }`
- Foto ausente → gradiente duotone rotulado com `city` (regra do `IconsImagery.dc.html`); `featured` → anel `--accent-wash`; `rationale` com `text-wrap: pretty`, 2 linhas.

- [ ] **Step 1: Testes (falham)** — renderiza cidade/país/rationale; `MatchBadge` com `matchValue`; `photoUrl` nulo → placeholder com o nome; `onSeeItinerary` dispara no botão "Ver roteiro"; `onToggleSave` no botão salvar; `featured` aplica a classe; `stats` renderizados.
- [ ] **Steps 2–4:** implementar (usa `Button` e `MatchBadge`/`MatchBar`); 100% + mutação.
- [ ] **Step 5: Commit** — `feat(ui): DestinationCard`

---

### Task 7: `AppShell` + `StepNav`

**Files:** `packages/ui/src/AppShell/{AppShell.tsx,AppShell.module.css}`, `packages/ui/src/StepNav/{StepNav.tsx,StepNav.module.css,*.stories.tsx}`, `AppShell.spec.tsx`, `StepNav.spec.tsx`

**Interfaces:** (`§3.6`, `§3.7`)
- `AppShellProps = { sidebar: React.ReactNode; children: React.ReactNode; rail: React.ReactNode }` — grid `var(--shell-sidebar) 1fr var(--shell-rail)`; `< 1080px` colapsa para 1 coluna (sidebar vira `Drawer` controlado por prop `sidebarOpen?`/`onSidebarOpenChange?`; rail vira aba inferior). Regiões com `role`/`aria-label` ("Navegação da viagem", "Conteúdo", "Assessor").
- `StepNavProps = { steps: { id: string; label: string; state: "done" | "current" | "todo" }[]; onNavigate?: (id: string) => void }` — `done` navega de volta; `todo` não é clicável; `current` marcado `aria-current="step"`.

- [ ] **Step 1: Testes (falham)** — `AppShell` renderiza as 3 regiões; em largura < 1080 (mock `matchMedia`) mostra o gatilho do drawer. `StepNav`: `done` clicável chama `onNavigate`; `todo` não; `current` tem `aria-current`.
- [ ] **Steps 2–4:** implementar; 100% + mutação.
- [ ] **Step 5: Commit** — `feat(ui): AppShell responsivo e StepNav`

---

### Task 8: `AdvisorChat`

**Files:** `packages/ui/src/AdvisorChat/{AdvisorChat.tsx,AdvisorChat.module.css,AdvisorChat.stories.tsx}`, `AdvisorChat.spec.tsx`

**Interfaces:** (`§3.8`, referência `Itinerary.dc.html` trilho)
- `AdvisorChatProps = { messages: { id: string; role: "user" | "assistant"; content: string }[]; onSend: (text: string) => void; pending?: boolean; placeholder?: string }` — bolhas por role; input fixo no rodapé com botão enviar `--accent`; `pending` desabilita o input e mostra indicador; `Enter` envia, `Shift+Enter` quebra linha; a lista rola para o fim ao chegar mensagem nova.

- [ ] **Step 1: Testes (falham)** — renderiza N bolhas com a classe por role; digitar + `Enter` chama `onSend` com o texto e limpa o input; `Shift+Enter` não envia; `pending` → input `disabled`; botão enviar desabilitado com input vazio.
- [ ] **Steps 2–4:** implementar; 100% + mutação.
- [ ] **Step 5: Commit** — `feat(ui): AdvisorChat`

---

### Task 9: Set de ícones

**Files:** `packages/ui/src/Icon/{Icon.tsx,icons.ts,Icon.stories.tsx}`, `Icon.spec.tsx`

**Interfaces:** (`docs/design-system.md §2.6`, referência `IconsImagery.dc.html`)
- `type IconName = "pin" | "calendar" | "plane" | "hotel" | "meal" | "weather" | "clock" | "sparkle" | "heart" | "arrow-right" | "chevron-down" | "check" | "search" | "export" | "share" | "close" | "plus" | "minus" | "star" | "map" | ...` (~24)
- `Icon({ name: IconName; size?: 14 | 16 | 18 | 20 | 24; title?: string })` — `<svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" stroke-width="1.6" fill="none">` com `stroke-linecap/linejoin="round"`; `title` → `role="img"` + `<title>`, sem `title` → `aria-hidden`.
- `icons.ts` — mapa `IconName → ReactNode` (paths inline, extraídos dos `.dc.html` e padronizados).

- [ ] **Step 1: Testes (falham)** — cada `IconName` renderiza um `<svg>` com `viewBox="0 0 24 24"` e `stroke-width="1.6"`; `size` aplica width/height; `title` gera `<title>` e `role="img"`; sem `title` → `aria-hidden="true"`; nome inexistente é erro de tipo (teste de tipo `expectTypeOf`).
- [ ] **Step 2: Run — falha.**
- [ ] **Step 3: Implementar** os ~24 paths. Trocar `iconStart?: ReactNode` por `iconStart?: IconName` no `Button`/`TextField` e ajustar os testes daqueles componentes.
- [ ] **Step 4: Run — passa (100%) + mutação.**
- [ ] **Step 5: Commit** — `feat(ui): set de ícones (24) com Icon acessível`

---

## Self-Review

**1. Spec coverage (`docs/design-system.md`):**
- §2.1–2.5 tokens (cor claro/escuro, tipografia, espaçamento, raio, elevação, movimento, control-h, shell) → Task 1. §2.6 ícones → Task 9.
- §3.1 Button → Task 2. §3.2 TextField/Stepper/Slider → Task 3. §3.3 Chip → Task 4. §3.4 MatchBadge → Task 5. §3.5 DestinationCard → Task 6. §3.6 AppShell + §3.7 StepNav → Task 7. §3.8 AdvisorChat → Task 8.
- §1 princípios (tokens primeiro, um acento, `--positive` restrito, A11y, alvo ≥ 44px) → guarda de valores mágicos (Task 1) + testes de A11y por componente.
- §4 pendências: DS1 (Radix) — nenhum componente deste plano usa overlay, entra depois; DS2 (estratégia de tokens em runtime) — decidida e comentada na Task 1; DS3 (set de ícones) → Task 9; DS5 (motion presets) — tokens de movimento entram na Task 1, presets de animação de entrada ficam para o Passo 8 (uso real).

**2. Placeholder scan:** sem "TBD". A ordem de execução vs. o set de ícones está resolvida: `Button`/`TextField` aceitam `ReactNode` até a Task 9 e migram para `IconName` lá (anotado nas Tasks 2, 3 e 9).

**3. Type consistency:** `IconName` (Task 9) é o tipo compartilhado por `Button`, `TextField`, `Icon`. `ButtonProps` reusado dentro de `DestinationCard` (Task 6). Tokens (`tokens.ts`, Task 1) referenciados por nome em todos os `.module.css`. Nenhum componente expõe estado interno além de UI visual (constraint), então as props controladas (`value`/`onChange`) são consistentes entre `TextField`, `Stepper`, `Slider`, `AdvisorChat`.

## Execução

Cobre o **Passo 9** do backlog. **Pode ser puxado em paralelo a partir do Passo 1**
(só depende do scaffold). O Passo 8 (UI web) consome este pacote. Puxar o passo 9
(guideline do `CLAUDE.md`) antes de começar.
