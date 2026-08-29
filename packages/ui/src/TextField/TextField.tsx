import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import "./TextField.css";

export type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  iconStart?: ReactNode;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "disabled">;

export function TextField({
  label,
  value,
  onChange,
  iconStart,
  placeholder,
  error,
  hint,
  disabled = false,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const describedById = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="farol-field">
      <label className="farol-field__label" htmlFor={id}>
        {label}
      </label>
      <div
        className={["farol-field__control", error && "farol-field__control--error"]
          .filter(Boolean)
          .join(" ")}
      >
        {iconStart && <span className="farol-field__icon">{iconStart}</span>}
        <input
          id={id}
          className="farol-field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="farol-field__error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="farol-field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
