# Farol — Design System

- **Status:** v0.1 (deriva do Manual de marca e das telas hi-fi)
- **Data:** 2026-08-28
- **Implementação alvo:** `packages/ui` no monorepo Turborepo
- **Manual de marca (visual):** canvas `Farol Brand`

Este documento é a fonte da verdade **em código** para tokens e componentes.
O manual de marca cobre logo, voz, fotografia e o racional; aqui ficam os valores
que o `packages/ui` implementa.

---

## 1. Princípios de implementação

- **Tokens primeiro.** Nenhum valor cromático, de espaçamento ou de tipografia
  hard-coded em componente. Tudo via CSS custom properties / tema.
- **Tema claro e escuro** definidos como conjuntos de tokens; componentes nunca
  checam o tema, só consomem os tokens.
- **Instrument Sans** para tudo que é texto de interface; **Bricolage Grotesque**
  só para títulos, números de destaque e wordmark.
- **Um acento.** `--accent` (terracota) carrega ação e marca. `--positive` (verde)
  só aparece em indicador de match e confirmação. Nada mais colorido entra.
- **Acessibilidade:** todo par texto/fundo ≥ WCAG AA (4.5:1 corpo, 3:1 grande).
  Foco sempre visível via anel `--ring`.
- **Alvos de toque** ≥ 44 px em qualquer controle interativo.

---

## 2. Tokens

### 2.1 Cor — tema claro (`:root`)

```css
:root {
  /* superfícies */
  --bg:            #fbfaf8;   /* oklch(0.985 0.004 85)  fundo da página */
  --surface:       #ffffff;   /* cards, inputs */
  --surface-sunk:  #f7f5f0;   /* sidebar, trilho de chat */
  --line:          #e9e7e1;   /* divisórias, bordas */
  --line-soft:     #f1efe9;   /* divisórias internas de lista */

  /* texto */
  --ink:           #1c1b19;   /* oklch(0.22 0.006 75)  títulos, corpo */
  --ink-muted:     #57554f;   /* texto de apoio forte */
  --text-muted:    #78766f;   /* secundário, rótulos  (4.7:1 sobre --bg) */
  --text-faint:    #9b9992;   /* legendas, placeholder (3.1:1 — só texto grande) */

  /* acento */
  --accent:        #c25a38;   /* oklch(0.585 0.115 42)  ação primária, marca */
  --accent-hover:  #ac4d2f;
  --accent-ink:    #8f3f26;   /* acento como texto / hover de link (6.1:1 sobre wash) */
  --accent-wash:   #f9efe9;   /* fundo de item selecionado, anel de foco */

  /* positivo (match / confirmação — uso restrito) */
  --positive:      #3d7a67;   /* oklch(0.52 0.068 165) */
  --positive-ink:  #2f6252;
  --positive-wash: #e8f0ec;

  /* foco */
  --ring:          0 0 0 3px var(--accent-wash);

  /* elevação */
  --elev-1: 0 1px 2px rgba(28,27,25,.04);
  --elev-2: 0 1px 2px rgba(28,27,25,.04), 0 12px 32px -16px rgba(28,27,25,.12);

  /* raio */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 16px;
  --radius-pill: 999px;

  /* movimento */
  --motion-fast: 120ms;
  --motion-base: 200ms;
  --motion-slow: 320ms;
  --ease: cubic-bezier(.2,.6,.2,1);
}
```

### 2.2 Cor — tema escuro (`[data-theme="dark"]`)

```css
[data-theme="dark"] {
  --bg:            #171614;
  --surface:       #1f1e1b;
  --surface-sunk:  #1a1917;
  --line:          #302e2a;
  --line-soft:     #262420;

  --ink:           #f4f2ec;
  --ink-muted:     #cdcabf;
  --text-muted:    #a8a59d;
  --text-faint:    #8a877f;

  --accent:        #d9714f;   /* elevado para contraste em fundo escuro */
  --accent-hover:  #e5825f;
  --accent-ink:    #e9a389;
  --accent-wash:   #2a231f;

  --positive:      #5fa38c;
  --positive-ink:  #8fc3b2;
  --positive-wash: #1e2a26;

  --elev-1: 0 1px 2px rgba(0,0,0,.4);
  --elev-2: 0 1px 2px rgba(0,0,0,.4), 0 12px 32px -16px rgba(0,0,0,.6);
}
```

### 2.3 Pares de contraste aprovados

| Fundo | Texto | Ratio | Uso |
|---|---|---|---|
| `--bg` | `--ink` | 15.8:1 | corpo, títulos |
| `--bg` | `--text-muted` | 4.7:1 | rótulos, legendas |
| `--accent` | `#ffffff` | 4.6:1 | botão primário |
| `--accent-wash` | `--accent-ink` | 6.1:1 | chip selecionado |
| `--surface` | `--positive-ink` | 4.8:1 | selo de match |

`--text-faint` sobre `--bg` é 3.1:1 — usar **somente** em texto ≥ 18px ou ícone decorativo.

### 2.4 Tipografia

```css
:root {
  --font-display: "Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif;
  --font-text:    "Instrument Sans", system-ui, -apple-system, sans-serif;
}
```

| Token | Família | Tam / Linha | Peso | Tracking | Uso |
|---|---|---|---|---|---|
| `--type-display-l` | display | 40 / 44 | 700 | -0.02em | hero, uma vez por tela |
| `--type-display-m` | display | 34 / 38 | 600 | -0.02em | título de página cheia |
| `--type-h1` | display | 28 / 34 | 600 | -0.02em | título principal da view |
| `--type-h2` | display | 22 / 28 | 600 | -0.01em | seção |
| `--type-h3` | display | 18 / 24 | 600 | 0 | subseção |
| `--type-body` | text | 15 / 24 | 400 | 0 | corpo padrão |
| `--type-body-strong` | text | 15 / 24 | 600 | 0 | ênfase, valores |
| `--type-small` | text | 13 / 20 | 400 | 0 | apoio, disclaimers |
| `--type-caption` | text | 12 / 16 | 500 | 0 | metadados (horário, duração) |
| `--type-overline` | text | 11 / 16 | 600 | 0.09em | rótulo de grupo, CAIXA ALTA |

Regras: um nível de display por tela · sem itálico para ênfase (peso 600 ou `--accent`) ·
caixa alta só em overline · linha de corpo entre 60–75 caracteres · PT-BR acentuado sempre.

Na exportação estática (PNG/PDF) as webfonts caem para o fallback — manter as stacks acima.

### 2.5 Espaçamento, layout e controles

```css
:root {
  --space-2: 2px;  --space-4: 4px;  --space-8: 8px;   --space-12: 12px;
  --space-16: 16px; --space-20: 20px; --space-24: 24px; --space-32: 32px;
  --space-40: 40px; --space-48: 48px; --space-64: 64px; --space-80: 80px;

  --control-h-sm: 36px;
  --control-h-md: 44px;
  --control-h-lg: 52px;

  --shell-sidebar: 248px;
  --shell-rail:    340px;
  --content-max:   1120px;
  --page-gutter:   40px;
}
```

Shell do app: `grid-template-columns: var(--shell-sidebar) 1fr var(--shell-rail)`.
Abaixo de **1080px**: uma coluna — sidebar vira menu, trilho de chat vira aba.

### 2.6 Ícones

- ViewBox 24 · `stroke-width` 1.6 · `stroke-linecap`/`linejoin` `round` · sem `fill`.
- Cor por `currentColor` (herda do texto).
- Tamanhos de render: 14, 16, 18, 20, 24. Acima disso, ilustração.
- Nunca emoji na interface.
- Entregues como componentes React (`<Icon name="pin" />`) a partir de um sprite/set único.

---

## 3. Componentes

Convenção: cada componente é uma pasta em `packages/ui/src/<Componente>/` com
`Componente.tsx`, `Componente.stories.tsx` e `Componente.spec.tsx` (TDD — spec primeiro,
conforme pipeline do projeto).

### 3.1 Button

**Props**
```ts
type ButtonProps = {
  variant?: "primary" | "ghost" | "text";   // default: "primary"
  size?: "sm" | "md" | "lg";                 // default: "md"
  iconStart?: IconName;
  iconEnd?: IconName;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;
```

**Especificação**

| | primary | ghost | text |
|---|---|---|---|
| fundo | `--accent` | `--surface` | transparente |
| texto | `#fff` | `--ink` | `--accent` |
| borda | — | `1.5px --line` | — |
| hover | `--accent-hover` | borda `#c9c5ba`, fundo `#faf8f4` | texto `--accent-ink` |
| disabled | `--accent` @ 45% opacidade de fundo, sem interação | opacidade 0.5 | opacidade 0.5 |

- Alturas: `sm` 36 / `md` 44 / `lg` 52. Padding-x: 14 / 22 / 26. Raio `--radius-sm`+2 (12px). Gap ícone/label 8.
- Foco: `box-shadow: var(--ring)` + `outline: none`.
- `loading`: troca o conteúdo por um spinner de 16px, mantém a largura, `aria-busy`.
- **Um único `primary` por view.** Ações secundárias são `ghost` ou `text`.

### 3.2 TextField

**Props**
```ts
type TextFieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  iconStart?: IconName;
  placeholder?: string;
  error?: string;         // presença => estado de erro
  hint?: string;
  disabled?: boolean;
};
```

- Container: borda `1.5px --line` (usa `#e6e3dc`, meio-tom entre `--line` e `--surface-sunk`), raio `--radius-sm`+2, padding `12px 14px`, altura mínima `--control-h-md`.
- Label: `--type-caption` peso 600, cor `--ink-muted`, `margin-bottom: 8px`.
- Ícone inicial: 16px, `--text-faint`.
- **Foco:** borda `--accent` + `box-shadow: var(--ring)`.
- **Erro:** borda `--accent`; `error` renderiza abaixo em `--type-small` cor `--accent-ink`.
- `hint` (quando não há erro): `--type-small` cor `--text-muted`.

Variantes derivadas (mesmo container): `Stepper` (valor + `–`/`+` 34px), `Slider`
(trilho 5px, preenchimento `--accent`, thumb 18px branco borda `--accent`).

### 3.3 Chip

```ts
type ChipProps = {
  children: React.ReactNode;
  selected?: boolean;
  tone?: "filter" | "taste";   // default: "filter"
  onClick?: () => void;
};
```

- Base: borda `1.5px --line`, raio pill, padding `8px 14px`, `--type-caption`, cor `--text-muted`, fundo `--surface`.
- `filter` + `selected`: fundo `--ink`, texto `#fff`, borda `--ink`.
- `taste` + `selected`: fundo `--accent-wash`, texto `--accent-ink`, borda `#e2c1b3`.
- Estático (informativo) = mesma base sem `onClick` e sem hover.

### 3.4 MatchBadge

```ts
type MatchBadgeProps = { value: number };  // 0–100
```

- Pílula `--surface`, `--elev` leve (`0 1px 4px rgba(28,27,25,.12)`), padding `5px 11px`.
- Texto `--type-caption` peso 700, cor `--positive-ink`; ponto de 6px `--positive` antes.
- **Único lugar** onde `--positive` aparece, junto da barra de match (`height 4px`,
  trilho `--line-soft`, preenchimento `--positive`).

### 3.5 DestinationCard

- Estrutura: `<figure>` foto 16:10 (raio herda do card) + corpo.
- Card: borda `--line`, `--radius-lg`, `--surface`, `--elev-1`.
- Foto sem imagem: gradiente duotone 155° (dois tons da mesma faixa), rótulo do
  lugar em `--type-caption` `#fff` com `text-shadow`, ícone câmera 13px tênue.
- Corpo: cidade `--type-h3` (display), país `--type-caption` `--text-faint`,
  barra de match, racional `--type-small` (2 linhas, `text-wrap: pretty`),
  faixa de stats (clima/voo/total) com ícones 14px, footer com `Button ghost sm` + botão salvar 36px.
- **Variante `featured`** (melhor match): adiciona `box-shadow: 0 0 0 3px var(--accent-wash)` e borda `#e7c3b4`.

### 3.6 AppShell

```ts
type AppShellProps = {
  sidebar: React.ReactNode;   // <TripSummary/> + <StepNav/>
  children: React.ReactNode;  // conteúdo da view
  rail: React.ReactNode;      // <AdvisorChat/>
};
```

- Grid `var(--shell-sidebar) 1fr var(--shell-rail)`, altura `100dvh`.
- Sidebar e rail: fundo `--surface-sunk`, divisórias `--line`, `overflow-y: auto` independente.
- Miolo: `padding: 34px var(--page-gutter) 56px`, conteúdo `max-width: var(--content-max)`.
- < 1080px: `grid-template-columns: 1fr`; sidebar em `<Drawer>`, rail em aba fixa inferior.

### 3.7 StepNav

- Lista vertical. Item: `done` (círculo preenchido `--ink-muted` + check 9px branco),
  `current` (fundo `--ink`, texto `#fff`, peso 500), `todo` (círculo vazado, `--text-muted`).
- Não é clicável para etapas futuras; etapas concluídas navegam de volta.

### 3.8 AdvisorChat (trilho)

- Header overline "Assessor" + ícone sparkle 15px `--accent`.
- Bolhas: assistente = `--surface` + borda `--line-soft`, texto `--ink-muted`;
  usuário = `--ink`, texto `#fff`. Raio 13, `max-width: 92%`.
- Input fixo no rodapé: container como `TextField`, botão enviar 30px `--accent` com seta.
- Toda mutação de estado disparada pelo chat atualiza o `TripState`; a UI relê após cada resposta.

---

## 4. Pendências

| # | Item | Nota |
|---|---|---|
| DS1 | Escolher lib base | headless (Radix / Ark) vs. do zero. Recomenda-se Radix para overlays/menus. |
| DS2 | Tokens em runtime | CSS vars + tema via `data-theme`; avaliar `@vanilla-extract` ou Tailwind v4 `@theme`. |
| DS3 | Ícones | montar o set inicial (~24 ícones) como sprite React a partir do manual. |
| DS4 | Bricolage no app | confirmar licença/entrega (self-host WOFF2 vs. Google Fonts CDN). |
| DS5 | Motion | definir presets de entrada (fade+rise 8px, `--motion-base`, `--ease`) para cards e bolhas. |
| DS6 | Domínio | ✅ `farolviagens.com` (2026-08-31). Telas de marca/B2B já atualizadas; falta registrar o domínio + reseed/republish dos canvases. |
