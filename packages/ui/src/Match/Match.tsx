import "./Match.css";

function clampPct(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export type MatchBadgeProps = { value: number };

export function MatchBadge({ value }: MatchBadgeProps) {
  const pct = clampPct(value);
  return (
    <span className="farol-match-badge" aria-label={`${pct}% de aderência`}>
      <span className="farol-match-badge__dot" aria-hidden="true" />
      {pct}%
    </span>
  );
}

export type MatchBarProps = { value: number };

export function MatchBar({ value }: MatchBarProps) {
  const pct = clampPct(value);
  return (
    <div
      className="farol-match-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <span className="farol-match-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
