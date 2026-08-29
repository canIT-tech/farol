// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
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
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = stryMutAct_9fa48("0") ? "" : (stryCov_9fa48("0"), "primary"),
  size = stryMutAct_9fa48("1") ? "" : (stryCov_9fa48("1"), "md"),
  iconStart,
  iconEnd,
  loading = stryMutAct_9fa48("2") ? true : (stryCov_9fa48("2"), false),
  disabled = stryMutAct_9fa48("3") ? true : (stryCov_9fa48("3"), false),
  type = stryMutAct_9fa48("4") ? "" : (stryCov_9fa48("4"), "button"),
  className,
  children,
  ...rest
}, ref) {
  if (stryMutAct_9fa48("5")) {
    {}
  } else {
    stryCov_9fa48("5");
    const classes = stryMutAct_9fa48("6") ? ["farol-btn", `farol-btn--${variant}`, `farol-btn--${size}`, className].join(" ") : (stryCov_9fa48("6"), (stryMutAct_9fa48("7") ? [] : (stryCov_9fa48("7"), [stryMutAct_9fa48("8") ? "" : (stryCov_9fa48("8"), "farol-btn"), stryMutAct_9fa48("9") ? `` : (stryCov_9fa48("9"), `farol-btn--${variant}`), stryMutAct_9fa48("10") ? `` : (stryCov_9fa48("10"), `farol-btn--${size}`), className])).filter(Boolean).join(stryMutAct_9fa48("11") ? "" : (stryCov_9fa48("11"), " ")));
    return <button ref={ref} type={type} className={classes} disabled={stryMutAct_9fa48("14") ? disabled && loading : stryMutAct_9fa48("13") ? false : stryMutAct_9fa48("12") ? true : (stryCov_9fa48("12", "13", "14"), disabled || loading)} aria-busy={stryMutAct_9fa48("17") ? loading && undefined : stryMutAct_9fa48("16") ? false : stryMutAct_9fa48("15") ? true : (stryCov_9fa48("15", "16", "17"), loading || undefined)} {...rest}>
      {loading ? <span className="farol-btn__spinner" aria-hidden="true" /> : stryMutAct_9fa48("20") ? iconStart || <span className="farol-btn__icon">{iconStart}</span> : stryMutAct_9fa48("19") ? false : stryMutAct_9fa48("18") ? true : (stryCov_9fa48("18", "19", "20"), iconStart && <span className="farol-btn__icon">{iconStart}</span>)}
      {children}
      {stryMutAct_9fa48("23") ? !loading && iconEnd || <span className="farol-btn__icon">{iconEnd}</span> : stryMutAct_9fa48("22") ? false : stryMutAct_9fa48("21") ? true : (stryCov_9fa48("21", "22", "23"), (stryMutAct_9fa48("25") ? !loading || iconEnd : stryMutAct_9fa48("24") ? true : (stryCov_9fa48("24", "25"), (stryMutAct_9fa48("26") ? loading : (stryCov_9fa48("26"), !loading)) && iconEnd)) && <span className="farol-btn__icon">{iconEnd}</span>)}
    </button>;
  }
});