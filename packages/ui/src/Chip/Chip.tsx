import type { ReactNode } from "react";
import "./Chip.css";

export type ChipTone = "filter" | "taste";

export type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  tone?: ChipTone;
  onClick?: () => void;
};

export function Chip({ children, selected = false, tone = "filter", onClick }: ChipProps) {
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

  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onClick}>
      {children}
    </button>
  );
}
