import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "ghost" | "text";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    iconStart,
    iconEnd,
    loading = false,
    disabled = false,
    type = "button",
    className,
    children,
    ...rest
  },
  ref
) {
  const classes = [
    "farol-btn",
    `farol-btn--${variant}`,
    `farol-btn--${size}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="farol-btn__spinner" aria-hidden="true" />
      ) : (
        iconStart && <span className="farol-btn__icon">{iconStart}</span>
      )}
      {children}
      {!loading && iconEnd && <span className="farol-btn__icon">{iconEnd}</span>}
    </button>
  );
});
