import { describe, it, expect } from "vitest";
import { isRetryableStatus } from "./retry.js";

describe("isRetryableStatus", () => {
  it("retenta em 429 e 5xx conhecidos", () => {
    for (const s of [429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(s)).toBe(true);
    }
  });

  it("não retenta em 2xx, 400, 401, 403, 404 e 501", () => {
    for (const s of [200, 400, 401, 403, 404, 501]) {
      expect(isRetryableStatus(s)).toBe(false);
    }
  });
});
