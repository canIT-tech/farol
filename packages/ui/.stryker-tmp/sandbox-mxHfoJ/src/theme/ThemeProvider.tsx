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
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type Theme = "light" | "dark" | "system";
type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
function applyTheme(theme: Theme): void {
  if (stryMutAct_9fa48("27")) {
    {}
  } else {
    stryCov_9fa48("27");
    const root = document.documentElement;
    if (stryMutAct_9fa48("30") ? theme !== "system" : stryMutAct_9fa48("29") ? false : stryMutAct_9fa48("28") ? true : (stryCov_9fa48("28", "29", "30"), theme === (stryMutAct_9fa48("31") ? "" : (stryCov_9fa48("31"), "system")))) {
      if (stryMutAct_9fa48("32")) {
        {}
      } else {
        stryCov_9fa48("32");
        root.removeAttribute(stryMutAct_9fa48("33") ? "" : (stryCov_9fa48("33"), "data-theme"));
      }
    } else {
      if (stryMutAct_9fa48("34")) {
        {}
      } else {
        stryCov_9fa48("34");
        root.setAttribute(stryMutAct_9fa48("35") ? "" : (stryCov_9fa48("35"), "data-theme"), theme);
      }
    }
  }
}
export function ThemeProvider({
  theme: initial = stryMutAct_9fa48("36") ? "" : (stryCov_9fa48("36"), "system"),
  children
}: {
  theme?: Theme;
  children: ReactNode;
}) {
  if (stryMutAct_9fa48("37")) {
    {}
  } else {
    stryCov_9fa48("37");
    const [theme, setThemeState] = useState<Theme>(initial);
    useEffect(() => {
      if (stryMutAct_9fa48("38")) {
        {}
      } else {
        stryCov_9fa48("38");
        applyTheme(theme);
      }
    }, stryMutAct_9fa48("39") ? [] : (stryCov_9fa48("39"), [theme]));
    const setTheme = useCallback((t: Theme) => {
      if (stryMutAct_9fa48("40")) {
        {}
      } else {
        stryCov_9fa48("40");
        setThemeState(t);
      }
    }, stryMutAct_9fa48("41") ? ["Stryker was here"] : (stryCov_9fa48("41"), []));
    const value = useMemo<ThemeContextValue>(stryMutAct_9fa48("42") ? () => undefined : (stryCov_9fa48("42"), () => stryMutAct_9fa48("43") ? {} : (stryCov_9fa48("43"), {
      theme,
      setTheme
    })), stryMutAct_9fa48("44") ? [] : (stryCov_9fa48("44"), [theme, setTheme]));
    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
  }
}
export function useTheme(): ThemeContextValue {
  if (stryMutAct_9fa48("45")) {
    {}
  } else {
    stryCov_9fa48("45");
    const ctx = useContext(ThemeContext);
    if (stryMutAct_9fa48("48") ? false : stryMutAct_9fa48("47") ? true : stryMutAct_9fa48("46") ? ctx : (stryCov_9fa48("46", "47", "48"), !ctx)) {
      if (stryMutAct_9fa48("49")) {
        {}
      } else {
        stryCov_9fa48("49");
        throw new Error(stryMutAct_9fa48("50") ? "" : (stryCov_9fa48("50"), "useTheme precisa estar dentro de <ThemeProvider>"));
      }
    }
    return ctx;
  }
}