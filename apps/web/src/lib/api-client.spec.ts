import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { apiFetch, apiFetchPublic, apiBase } from "./api-client";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

const schema = z.object({ id: z.string() });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("apiBase", () => {
  it("cai para localhost:3333/api sem env", () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(apiBase()).toBe("http://localhost:3333/api");
  });

  it("usa NEXT_PUBLIC_API_URL quando definida", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    expect(apiBase()).toBe("https://api.farol.test");
  });
});

describe("apiFetch", () => {
  it("faz GET em {base}{path} com Bearer e no-store, e valida a resposta", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "p-1" }));

    const out = await apiFetch({ path: "/me/profile", schema, token: "tok-123" }, fetchImpl);

    expect(out).toEqual({ id: "p-1" });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.farol.test/me/profile", {
      method: "GET",
      headers: { authorization: "Bearer tok-123" },
      cache: "no-store"
    });
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("body");
  });

  it("envia body JSON e content-type quando há body, com o método informado", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "p-2" }));

    await apiFetch(
      { path: "/me/profile", schema, token: "t", method: "PUT", body: { a: 1 } },
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:3333/api/me/profile", {
      method: "PUT",
      headers: { authorization: "Bearer t", "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
      cache: "no-store"
    });
  });

  it("lança com path e status quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    await expect(
      apiFetch({ path: "/me/profile", schema, token: "t" }, fetchImpl)
    ).rejects.toThrow("api /me/profile respondeu 401");
  });

  it("lança quando o payload não bate o schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 42 }));
    await expect(apiFetch({ path: "/x", schema, token: "t" }, fetchImpl)).rejects.toThrow();
  });
});

describe("apiFetchPublic", () => {
  it("chama sem Authorization e valida o payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: "x" }));
    await expect(apiFetchPublic({ path: "/geo/whereami", schema }, fetchImpl)).resolves.toEqual({
      id: "x"
    });
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:3333/api/geo/whereami", {
      cache: "no-store"
    });
  });

  it("lança com path e status quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(apiFetchPublic({ path: "/geo/whereami", schema }, fetchImpl)).rejects.toThrow(
      "api /geo/whereami respondeu 503"
    );
  });

  it("lança quando o payload não bate o schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ id: 42 }));
    await expect(apiFetchPublic({ path: "/x", schema }, fetchImpl)).rejects.toThrow();
  });
});
