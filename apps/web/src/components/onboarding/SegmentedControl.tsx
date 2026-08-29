"use client";

export interface SegmentedOption {
  value: string;
  label: string;
}

export function SegmentedControl({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: readonly SegmentedOption[];
  value: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
