/**
 * Referência em TS para os tokens de `tokens.css`. Use quando precisar do
 * valor `var(--x)` dentro de estilos inline; o CSS puro é a fonte da verdade.
 *
 * Decisão (DS2): CSS puro com prefixo `farol-` (BEM), não CSS Modules —
 * evita o atrito de importar CSS Modules de node_modules no Next.js.
 */
export const token = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surfaceSunk: "var(--surface-sunk)",
  line: "var(--line)",
  lineSoft: "var(--line-soft)",
  fieldBorder: "var(--field-border)",

  ink: "var(--ink)",
  inkMuted: "var(--ink-muted)",
  textMuted: "var(--text-muted)",
  textFaint: "var(--text-faint)",

  accent: "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentInk: "var(--accent-ink)",
  accentWash: "var(--accent-wash)",
  accentBorder: "var(--accent-border)",

  positive: "var(--positive)",
  positiveInk: "var(--positive-ink)",
  positiveWash: "var(--positive-wash)",

  ring: "var(--ring)",
  elev1: "var(--elev-1)",
  elev2: "var(--elev-2)",

  radiusSm: "var(--radius-sm)",
  radiusMd: "var(--radius-md)",
  radiusLg: "var(--radius-lg)",
  radiusPill: "var(--radius-pill)",

  motionFast: "var(--motion-fast)",
  motionBase: "var(--motion-base)",
  motionSlow: "var(--motion-slow)",
  ease: "var(--ease)",

  fontDisplay: "var(--font-display)",
  fontText: "var(--font-text)"
} as const;

export type TokenName = keyof typeof token;
