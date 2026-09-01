import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { POLL_MS, useItineraryPolling } from "./useItineraryPolling";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

function itinerary(status: "pending" | "ready" | "failed") {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    tripId: TRIP_ID,
    version: 1,
    status,
    error: null,
    generatedAt: null,
    days: []
  };
}

function respond(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useItineraryPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("carrega uma vez quando já vem pronto e não repergunta", async () => {
    const f = vi.fn(async () => respond(itinerary("ready")));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.itinerary?.status).toBe("ready");

    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 3);
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("repergunta enquanto está pendente e para ao ficar pronto", async () => {
    let chamadas = 0;
    const f = vi.fn(async () => {
      chamadas += 1;
      return respond(itinerary(chamadas < 3 ? "pending" : "ready"));
    });
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.itinerary?.status).toBe("pending"));

    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    await waitFor(() => expect(result.current.itinerary?.status).toBe("ready"));

    const depois = f.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 2);
    });
    expect(f).toHaveBeenCalledTimes(depois);
  });

  it("para de reperguntar quando falha a geração", async () => {
    const f = vi.fn(async () => respond(itinerary("failed")));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.itinerary?.status).toBe("failed"));
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 2);
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("erro de rede vira mensagem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("sem rede");
      })
    );
    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.error).toBe("sem rede"));
  });

  it("erro não-Error vira mensagem genérica", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw "pane";
      })
    );
    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.error).toBe("erro ao carregar o roteiro"));
  });

  it("refetch busca de novo sob demanda", async () => {
    const f = vi.fn(async () => respond(itinerary("ready")));
    vi.stubGlobal("fetch", f);
    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refetch();
    });
    expect(f).toHaveBeenCalledTimes(2);
  });
});
