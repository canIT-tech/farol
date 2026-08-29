import { useId } from "react";
import "./Stepper.css";

export type StepperProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

export function Stepper({
  label,
  value,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  onChange
}: StepperProps) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="farol-stepper">
      <span id={id} className="farol-stepper__label">
        {label}
      </span>
      <div className="farol-stepper__row" role="group" aria-labelledby={id}>
        <button
          type="button"
          className="farol-stepper__btn"
          aria-label={`Diminuir ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          –
        </button>
        <span className="farol-stepper__value" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          className="farol-stepper__btn"
          aria-label={`Aumentar ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}
