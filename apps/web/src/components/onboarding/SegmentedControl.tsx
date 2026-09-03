"use client";

export interface SegmentedOption {
  value: string;
  label: string;
}

export type SegmentedVariant = "segmented" | "pills";

export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  variant = "segmented"
}: {
  label: string;
  options: readonly SegmentedOption[];
  value: string | null;
  onChange: (value: string) => void;
  variant?: SegmentedVariant;
}) {
  const isPills = variant === "pills";
  return (
    <fieldset className="screen__row">
      <legend className="screen__label">{label}</legend>
      <div className={isPills ? "ob-pills" : "ob-seg"} role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const on = value === option.value;
          const base = isPills ? "ob-pill" : "ob-seg__item";
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              className={on ? `${base} ${base}--on` : base}
              aria-checked={on}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
