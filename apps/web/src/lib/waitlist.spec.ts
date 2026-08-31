import { describe, it, expect, vi, afterEach } from "vitest";
import { submitWaitlist, fetchWaitlistCount } from "./waitlist";

const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;
afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("submitWaitlist", () => {
  it("faz POST em {base}/waitlist com email e source, e valida a resposta", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.farol.test";
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true, created: true }));

    const out = await submitWaitlist("ana@farol.app", "landing-hero", fetchImpl);

    expect(out).toEqual({ ok: true, created: true });
    expect(fetchImpl).toHaveBeenCalledWith("https://api.farol.test/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ana@farol.app", source: "landing-hero" })
    });
  });

  it("lança com o status quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(submitWaitlist("ana@farol.app", "x", fetchImpl)).rejects.toThrow(
      "waitlist respondeu 500"
    );
  });

  it("lança quando o payload não bate o schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: false }));
    await expect(submitWaitlist("ana@farol.app", "x", fetchImpl)).rejects.toThrow();
  });
});

describe("fetchWaitlistCount", () => {
  it("faz GET em {base}/waitlist/count e valida a resposta", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ count: 9 }));

    const out = await fetchWaitlistCount(fetchImpl);

    expect(out).toEqual({ count: 9 });
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:3333/waitlist/count", {
      cache: "no-store"
    });
  });

  it("lança com o status quando a resposta não é ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(fetchWaitlistCount(fetchImpl)).rejects.toThrow("waitlist/count respondeu 503");
  });

  it("lança quando o payload não bate o schema", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ count: -1 }));
    await expect(fetchWaitlistCount(fetchImpl)).rejects.toThrow();
  });
});
