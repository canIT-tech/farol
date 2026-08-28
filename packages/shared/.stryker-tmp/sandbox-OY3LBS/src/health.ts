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
import { z } from "zod";
export const healthResponseSchema = z.object(stryMutAct_9fa48("7") ? {} : (stryCov_9fa48("7"), {
  status: z.enum(stryMutAct_9fa48("8") ? [] : (stryCov_9fa48("8"), [stryMutAct_9fa48("9") ? "" : (stryCov_9fa48("9"), "ok"), stryMutAct_9fa48("10") ? "" : (stryCov_9fa48("10"), "degraded")])),
  checks: z.object(stryMutAct_9fa48("11") ? {} : (stryCov_9fa48("11"), {
    db: z.enum(stryMutAct_9fa48("12") ? [] : (stryCov_9fa48("12"), [stryMutAct_9fa48("13") ? "" : (stryCov_9fa48("13"), "up"), stryMutAct_9fa48("14") ? "" : (stryCov_9fa48("14"), "down")]))
  })),
  version: z.string()
}));
export type HealthResponse = z.infer<typeof healthResponseSchema>;