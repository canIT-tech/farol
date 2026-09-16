import { describe, it, expect, beforeEach } from "vitest";
import {
  safeReturnTo,
  saveReturnTo,
  takeReturnTo,
  saveCreditsBefore,
  takeCreditsBefore
} from "./return-to";

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("safeReturnTo", () => {
  it("aceita caminho relativo do app", () => {
    expect(safeReturnTo("/trips/1/discovery")).toBe("/trips/1/discovery");
  });

  it("recusa url absoluta, protocolo relativo, vazio e não-string", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/trips");
    expect(safeReturnTo("//evil.example")).toBe("/trips");
    expect(safeReturnTo("")).toBe("/trips");
    expect(safeReturnTo(null)).toBe("/trips");
    expect(safeReturnTo(undefined)).toBe("/trips");
  });
});

describe("saveReturnTo / takeReturnTo", () => {
  it("guarda, devolve uma vez e limpa", () => {
    saveReturnTo("/trips/abc/discovery");
    expect(takeReturnTo()).toBe("/trips/abc/discovery");
    expect(takeReturnTo()).toBe("/trips");
  });

  it("valor perigoso guardado vira a casa", () => {
    saveReturnTo("https://evil.example");
    expect(takeReturnTo()).toBe("/trips");
  });
});

describe("saveCreditsBefore / takeCreditsBefore", () => {
  it("guarda o saldo e devolve uma vez", () => {
    saveCreditsBefore(2);
    expect(takeCreditsBefore()).toBe(2);
    expect(takeCreditsBefore()).toBe(0);
  });

  it("lixo no storage vira zero", () => {
    window.sessionStorage.setItem("farol:creditsBefore", "abc");
    expect(takeCreditsBefore()).toBe(0);
    window.sessionStorage.setItem("farol:creditsBefore", "-3");
    expect(takeCreditsBefore()).toBe(0);
  });
});
