import type { ReactNode } from "react";
import "./Chip.css";

export type ChipTone = "filter" | "taste";

export type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  tone?: ChipTone;
  onClick?: () => void;
  /** "tab" quando o chip vive dentro de um role="tablist". */
  role?: "tab";
};

export function Chip({
  children,
  selected = false,
  tone = "filter",
  onClick,
  role
}: ChipProps) {
  const className = [
    "farol-chip",
    `farol-chip--${tone}`,
    selected && "farol-chip--selected",
    onClick && "farol-chip--interactive"
  ]
    .filter(Boolean)
    .join(" ");

  if (!onClick) {
    return <span className={className}>{children}</span>;
  }

  // Dentro de um tablist o estado correto é aria-selected; aria-pressed ali
  // seria ARIA inválida (botão de alternância dentro de lista de abas).
  return (
    <button
      type="button"
      className={className}
      role={role}
      aria-pressed={role === undefined ? selected : undefined}
      aria-selected={role === undefined ? undefined : selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
