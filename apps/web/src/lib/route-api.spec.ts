import { describe, it, expect, vi } from "vitest";
import { getRouteMonths, getRouteOffers } from "./route-api";

const emptySection = { offers: [], stale: false, fetchedAt: null, error: null };

function fakeFetch(body: unknown = emptySection) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body)
  });
}

const urlOf = (f: ReturnType<typeof fakeFetch>) => String(f.mock.calls[0]![0]);

describe("getRouteMonths", () => {
  it("monta a query com rota e passageiros", async () => {
    const f = fakeFetch();
    await getRouteMonths(
      "tok",
      { origin: "FLN", destination: "SYD", adults: 2, children: 1 },
      f as unknown as typeof fetch
    );
    const url = urlOf(f);
    expect(url).toContain("/routes/months");
    expect(url).toContain("origin=FLN");
    expect(url).toContain("destination=SYD");
    expect(url).toContain("adults=2");
    expect(url).toContain("children=1");
  });

  it("devolve a seção validada", async () => {
    const f = fakeFetch();
    await expect(
      getRouteMonths(
        "tok",
        { origin: "FLN", destination: "SYD", adults: 1, children: 0 },
        f as unknown as typeof fetch
      )
    ).resolves.toEqual(emptySection);
  });
});

describe("getRouteOffers", () => {
  const base = { origin: "FLN", destination: "SYD", adults: 1, children: 0, depart: "2027-02-11" };

  it("inclui a volta quando existe", async () => {
    const f = fakeFetch();
    await getRouteOffers(
      "tok",
      { ...base, return: "2027-02-25" },
      f as unknown as typeof fetch
    );
    expect(urlOf(f)).toContain("return=2027-02-25");
  });

  // Um `undefined` solto em URLSearchParams viraria "return=undefined", e a api
  // reprovaria a data. O parâmetro precisa sumir, não virar texto.
  it("omite a volta na ida só", async () => {
    const f = fakeFetch();
    await getRouteOffers("tok", base, f as unknown as typeof fetch);
    const url = urlOf(f);
    expect(url).not.toContain("return=");
    expect(url).toContain("depart=2027-02-11");
  });

  it("devolve a seção validada", async () => {
    const f = fakeFetch();
    await expect(
      getRouteOffers("tok", base, f as unknown as typeof fetch)
    ).resolves.toEqual(emptySection);
  });
});
