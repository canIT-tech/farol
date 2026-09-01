import { describe, it, expect, vi } from "vitest";
import { AmadeusAuth, type AmadeusAuthConfig } from "./amadeus-auth.js";

function tokenResponse(token: string, expiresIn = 1800): Response {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

const cfg = (over: Partial<AmadeusAuthConfig> = {}): AmadeusAuthConfig => ({
  baseUrl: "https://test.api.amadeus.com",
  clientId: "cid",
  clientSecret: "secret",
  ...over
});

describe("AmadeusAuth.getToken", () => {
  it("busca o token na primeira chamada com grant_type=client_credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(tokenResponse("tok-1"));
    const auth = new AmadeusAuth(cfg({ fetchImpl, now: () => 0 }));

    await expect(auth.getToken()).resolves.toBe("tok-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://test.api.amadeus.com/v1/security/oauth2/token");
    expect(init.method).toBe("POST");
    expect(init.body).toContain("grant_type=client_credentials");
    expect(init.body).toContain("client_id=cid");
    expect(init.body).toContain("client_secret=secret");
    expect(init.headers["content-type"]).toBe("application/x-www-form-urlencoded");
  });

  it("reaproveita o token enquanto não expirou", async () => {
    let now = 0;
    const fetchImpl = vi.fn().mockResolvedValue(tokenResponse("tok-1", 1800));
    const auth = new AmadeusAuth(cfg({ fetchImpl, now: () => now }));

    await auth.getToken();
    now = 1_000_000; // < expiresAt (1800*1000 - 30000 = 1_770_000)
    await expect(auth.getToken()).resolves.toBe("tok-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("renova o token depois que (now + margem) passa do exp", async () => {
    let now = 0;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse("tok-1", 1800))
      .mockResolvedValueOnce(tokenResponse("tok-2", 1800));
    const auth = new AmadeusAuth(cfg({ fetchImpl, now: () => now }));

    await expect(auth.getToken()).resolves.toBe("tok-1");
    now = 1_770_000; // == expiresAt → não é mais "< expiresAt"
    await expect(auth.getToken()).resolves.toBe("tok-2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("lança quando o endpoint de token responde erro", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    const auth = new AmadeusAuth(cfg({ fetchImpl }));
    await expect(auth.getToken()).rejects.toThrow("Amadeus auth falhou: 401");
  });

  it("usa Date.now real quando now não é injetado (token válido é reaproveitado)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(tokenResponse("tok-1", 1800));
    const auth = new AmadeusAuth(cfg({ fetchImpl })); // sem `now`

    await auth.getToken();
    await expect(auth.getToken()).resolves.toBe("tok-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("usa o fetch global quando não é injetado", () => {
    expect(
      () => new AmadeusAuth({ baseUrl: "https://x", clientId: "c", clientSecret: "s" })
    ).not.toThrow();
  });
});
