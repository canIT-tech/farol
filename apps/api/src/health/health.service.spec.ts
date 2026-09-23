import { describe, it, expect, vi, afterEach } from "vitest";
import { HealthService } from "./health.service";

const dbOk = { execute: vi.fn().mockResolvedValue([{ "?column?": 1 }]) };
const dbDown = { execute: vi.fn().mockRejectedValue(new Error("no conn")) };

const originalVersion = process.env.npm_package_version;
const originalSha = process.env.RENDER_GIT_COMMIT;
afterEach(() => {
  if (originalVersion === undefined) delete process.env.npm_package_version;
  else process.env.npm_package_version = originalVersion;
  if (originalSha === undefined) delete process.env.RENDER_GIT_COMMIT;
  else process.env.RENDER_GIT_COMMIT = originalSha;
});

describe("HealthService", () => {
  it("status ok quando o banco responde", async () => {
    const res = await new HealthService(dbOk as never).check();
    expect(res).toMatchObject({ status: "ok", checks: { db: "up" } });
  });

  it("status degraded quando o banco falha", async () => {
    const res = await new HealthService(dbDown as never).check();
    expect(res).toMatchObject({ status: "degraded", checks: { db: "down" } });
  });

  it("usa npm_package_version quando presente", async () => {
    process.env.npm_package_version = "9.9.9";
    const res = await new HealthService(dbOk as never).check();
    expect(res.version).toBe("9.9.9");
  });

  it("cai para 0.0.0 quando npm_package_version não está definida", async () => {
    delete process.env.npm_package_version;
    const res = await new HealthService(dbDown as never).check();
    expect(res.version).toBe("0.0.0");
  });

  it("usa o commit do Render como sha", async () => {
    process.env.RENDER_GIT_COMMIT = "a0660ab";
    const ok = await new HealthService(dbOk as never).check();
    const down = await new HealthService(dbDown as never).check();
    expect(ok.sha).toBe("a0660ab");
    expect(down.sha).toBe("a0660ab");
  });

  it("cai para dev quando RENDER_GIT_COMMIT não está definida", async () => {
    delete process.env.RENDER_GIT_COMMIT;
    const res = await new HealthService(dbOk as never).check();
    expect(res.sha).toBe("dev");
  });
});
