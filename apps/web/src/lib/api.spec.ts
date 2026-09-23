import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchHealth, apiBase } from "./api";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

const okBody = { status: "ok", checks: { db: "up" }, version: "0.0.0", sha: "dev" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("fetchHealth", () => {
  it("retorna o payload validado", async () => {
    const res = await fetchHealth(vi.fn().mockResolvedValue(jsonResponse(okBody)) as never);
    expect(res.status).toBe("ok");
    expect(res.checks.db).toBe("up");
  });

  it("lança quando o payload não bate o schema", async () => {
    const bad = jsonResponse({ status: "nope" });
    await expect(fetchHealth(vi.fn().mockResolvedValue(bad) as never)).rejects.toThrow();
  });

  it("lança em status HTTP != 200", async () => {
    const err = new Response("erro", { status: 503 });
    await expect(fetchHealth(vi.fn().mockResolvedValue(err) as never)).rejects.toThrow(/503/);
  });

  it("usa http://localhost:3333/api quando NEXT_PUBLIC_API_URL não está definida", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(apiBase()).toBe("http://localhost:3333/api");
  });

  it("usa NEXT_PUBLIC_API_URL quando definida", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    expect(apiBase()).toBe("https://api.farol.test");
  });

  it("chama {base}/health com no-store", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    const spy = vi.fn().mockResolvedValue(jsonResponse(okBody));
    await fetchHealth(spy as never);
    expect(spy).toHaveBeenCalledWith("https://api.farol.test/health", { cache: "no-store" });
  });
});
