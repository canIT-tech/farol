import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { POLL_MS, POLL_TIMEOUT_MS, useItineraryPolling } from "./useItineraryPolling";

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

describe("useItineraryPolling quando a geração não termina", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  // O que aconteceu de verdade: o worker morreu, o job ficou parado na fila e a
  // tela repergunta para sempre prometendo "menos de um minuto". Desistir é o
  // que transforma um travamento invisível em uma mensagem acionável.
  it("desiste depois do limite e avisa", async () => {
    const f = vi.fn(async () => respond(itinerary("pending")));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stalled).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(POLL_TIMEOUT_MS + POLL_MS);
    });

    await waitFor(() => expect(result.current.stalled).toBe(true));
    const depoisDeDesistir = f.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 5);
    });
    expect(f.mock.calls.length).toBe(depoisDeDesistir);
  });

  it("continua reperguntando enquanto está dentro do limite", async () => {
    const f = vi.fn(async () => respond(itinerary("pending")));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 3);
    });
    expect(result.current.stalled).toBe(false);
    expect(f.mock.calls.length).toBeGreaterThan(1);
  });

  // Desistir não é um estado final: o worker pode voltar, e o botão "tentar de
  // novo" precisa reabrir a janela em vez de responder com o mesmo aviso.
  it("volta a reperguntar quando quem está na tela pede de novo", async () => {
    const f = vi.fn(async () => respond(itinerary("pending")));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      vi.advanceTimersByTime(POLL_TIMEOUT_MS + POLL_MS);
    });
    await waitFor(() => expect(result.current.stalled).toBe(true));

    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.stalled).toBe(false);

    const antes = f.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 2);
    });
    expect(f.mock.calls.length).toBeGreaterThan(antes);
  });

  // Ficar pronto depois de ter desistido tem que limpar o aviso.
  it("limpa o aviso se o roteiro enfim chega", async () => {
    let status: "pending" | "ready" = "pending";
    const f = vi.fn(async () => respond(itinerary(status)));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      vi.advanceTimersByTime(POLL_TIMEOUT_MS + POLL_MS);
    });
    await waitFor(() => expect(result.current.stalled).toBe(true));

    status = "ready";
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.itinerary?.status).toBe("ready"));
    expect(result.current.stalled).toBe(false);
  });
});

describe("useItineraryPolling — bordas do limite e limpeza", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("começa carregando", () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(itinerary("pending"))));
    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    expect(result.current.loading).toBe(true);
  });

  // Exatamente no limite já conta como travado. Sem este caso, trocar >= por >
  // passaria batido e a tela ficaria mais uma rodada prometendo o que não vem.
  //
  // Relógio congelado (sem shouldAdvanceTime): só o advanceTimersByTime move o
  // Date.now, então o tempo decorrido é exatamente o limite. Com o relógio real
  // andando durante o act, passaria alguns milissegundos do limite e as duas
  // comparações ficariam verdadeiras.
  it("desiste exatamente ao completar o limite", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const f = vi.fn(async () => respond(itinerary("pending")));
    vi.stubGlobal("fetch", f);

    const { result } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Um passo antes do limite ainda repergunta.
    await act(async () => {
      vi.advanceTimersByTime(POLL_TIMEOUT_MS - POLL_MS);
    });
    expect(result.current.stalled).toBe(false);

    // Sem waitFor de propósito: ele deixa o relógio real andar e daria mais uma
    // rodada de folga, escondendo a diferença entre >= e > no limite.
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    expect(result.current.stalled).toBe(true);
  });

  // Sair da tela tem que cancelar a próxima pergunta: sem isso o timer segue
  // vivo e o componente desmontado continua chamando a api.
  it("para de perguntar quando a tela é desmontada", async () => {
    const f = vi.fn(async () => respond(itinerary("pending")));
    vi.stubGlobal("fetch", f);

    const { result, unmount } = renderHook(() => useItineraryPolling("tok", TRIP_ID));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const antes = f.mock.calls.length;

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS * 4);
    });
    expect(f.mock.calls.length).toBe(antes);
  });
});
