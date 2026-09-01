import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { TripProvider, useTrip } from "./TripProvider";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

const state = {
  id: TRIP_ID,
  userId: "22222222-2222-4222-8222-222222222222",
  status: "draft",
  title: null,
  originIata: "GRU",
  dateStart: null,
  dateEnd: null,
  durationDays: 7,
  targetMonth: "2026-09",
  party: { adults: 2, children: 0 },
  budgetTotal: 12000,
  currency: "BRL",
  chosenDestinationId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  destinations: [],
  chosenDestination: null
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <TripProvider tripId={TRIP_ID} token="token">
      {children}
    </TripProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(state), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useTrip", () => {
  it("começa carregando e termina com a viagem", async () => {
    const { result } = renderHook(() => useTrip(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.trip).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.trip?.originIata).toBe("GRU");
    expect(result.current.error).toBeNull();
  });

  it("refetch busca de novo", async () => {
    const { result } = renderHook(() => useTrip(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refetch();
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it("erro de rede vira mensagem, sem derrubar a tela", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("rede caiu");
      })
    );
    const { result } = renderHook(() => useTrip(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("rede caiu");
    expect(result.current.trip).toBeNull();
  });

  it("erro HTTP vira mensagem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const { result } = renderHook(() => useTrip(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain("500");
  });

  it("erro não-Error vira mensagem genérica", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw "pane";
      })
    );
    const { result } = renderHook(() => useTrip(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("erro ao carregar a viagem");
  });

  it("um refetch que dá certo limpa o erro anterior", async () => {
    const falha = vi.fn(async () => new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", falha);
    const { result } = renderHook(() => useTrip(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(state), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.trip?.id).toBe(TRIP_ID);
  });

  it("usar useTrip fora do provider é erro de programação", () => {
    expect(() => renderHook(() => useTrip())).toThrow(/TripProvider/);
  });
});
