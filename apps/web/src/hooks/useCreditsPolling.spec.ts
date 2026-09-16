import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCreditsPolling, POLL_EVERY_MS, POLL_TIMEOUT_MS } from "./useCreditsPolling";

const getPaymentMe = vi.hoisted(() => vi.fn());
vi.mock("../lib/payments-api", () => ({ getPaymentMe }));

const me = (credits: number) => ({ credits, freeItineraryUsed: true, orders: [] });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  getPaymentMe.mockReset();
});

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useCreditsPolling", () => {
  it("fica em waiting enquanto o saldo não sobe e vira done quando sobe", async () => {
    getPaymentMe.mockResolvedValueOnce(me(1)).mockResolvedValueOnce(me(2));
    const { result } = renderHook(() => useCreditsPolling("tok", 1));

    await advance(0);
    expect(result.current).toBe("waiting");

    await advance(POLL_EVERY_MS);
    expect(result.current).toBe("done");
    expect(getPaymentMe).toHaveBeenCalledTimes(2);
  });

  it("erro na consulta não derruba o polling", async () => {
    getPaymentMe.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(me(5));
    const { result } = renderHook(() => useCreditsPolling("tok", 0));

    await advance(0);
    await advance(POLL_EVERY_MS);
    expect(result.current).toBe("done");
  });

  it("desiste depois do tempo limite", async () => {
    getPaymentMe.mockResolvedValue(me(0));
    const { result } = renderHook(() => useCreditsPolling("tok", 0));

    await advance(POLL_TIMEOUT_MS + POLL_EVERY_MS);
    expect(result.current).toBe("timeout");
    const calls = getPaymentMe.mock.calls.length;
    await advance(POLL_EVERY_MS * 3);
    expect(getPaymentMe).toHaveBeenCalledTimes(calls);
  });

  it("desmontar para de consultar", async () => {
    getPaymentMe.mockResolvedValue(me(0));
    const { unmount } = renderHook(() => useCreditsPolling("tok", 0));
    await advance(0);
    unmount();
    await advance(POLL_EVERY_MS * 3);
    expect(getPaymentMe).toHaveBeenCalledTimes(1);
  });
});
