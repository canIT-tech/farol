import { describe, it, expect, vi } from "vitest";
import { getPaymentMe, startCheckout } from "./payments-api";

function fakeFetch(body: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(body) });
}

describe("getPaymentMe", () => {
  it("consulta /payments/me com o token e devolve o resumo validado", async () => {
    const me = { credits: 2, freeItineraryUsed: true, orders: [] };
    const f = fakeFetch(me);
    await expect(getPaymentMe("tok", f as unknown as typeof fetch)).resolves.toEqual(me);
    const [url, init] = f.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/payments/me");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("recusa resposta fora do schema", async () => {
    const f = fakeFetch({ credits: -1, freeItineraryUsed: false, orders: [] });
    await expect(getPaymentMe("tok", f as unknown as typeof fetch)).rejects.toThrow(/não reconheço/);
  });
});

describe("startCheckout", () => {
  it("faz POST /payments/checkout com o produto e devolve a url", async () => {
    const f = fakeFetch({ url: "https://checkout.stripe.com/c/x" });
    await expect(startCheckout("tok", "pack3", f as unknown as typeof fetch)).resolves.toEqual({
      url: "https://checkout.stripe.com/c/x"
    });
    const [url, init] = f.mock.calls[0]! as [string, RequestInit];
    expect(url).toContain("/payments/checkout");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ product: "pack3" });
  });
});
