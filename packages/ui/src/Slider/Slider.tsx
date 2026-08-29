import { useId } from "react";
import "./Slider.css";

export type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue = (n) => String(n)
}: SliderProps) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className="farol-slider">
      <div className="farol-slider__head">
        <span id={id} className="farol-slider__label">
          {label}
        </span>
        <span className="farol-slider__value">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        className="farol-slider__input"
        aria-labelledby={id}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ "--farol-slider-pct": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}
