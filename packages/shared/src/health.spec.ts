import { describe, it, expect } from "vitest";
import { healthResponseSchema } from "./health";

describe("healthResponseSchema", () => {
  it("aceita um payload válido", () => {
    const ok = healthResponseSchema.parse({
      status: "ok",
      checks: { db: "up" },
      version: "0.0.0"
    });
    expect(ok.status).toBe("ok");
  });

  it("aceita status degraded com db down", () => {
    const degraded = healthResponseSchema.parse({
      status: "degraded",
      checks: { db: "down" },
      version: "1.2.3"
    });
    expect(degraded.status).toBe("degraded");
    expect(degraded.checks.db).toBe("down");
  });

  it("rejeita status fora do enum", () => {
    expect(() =>
      healthResponseSchema.parse({ status: "fine", checks: { db: "up" }, version: "0.0.0" })
    ).toThrow();
  });

  it("rejeita check db ausente", () => {
    expect(() =>
      healthResponseSchema.parse({ status: "ok", checks: {}, version: "0.0.0" })
    ).toThrow();
  });
});
