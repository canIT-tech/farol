import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { IDLE_EVENTS, useIdleTimer } from "./useIdleTimer";

const MS = 30_000;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

function activity(type: string) {
  act(() => {
    window.dispatchEvent(new Event(type));
  });
}

describe("useIdleTimer", () => {
  it("chama onIdle depois do tempo sem atividade", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ ms: MS, onIdle }));
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(MS);
    });
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("não chama antes da hora", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ ms: MS, onIdle }));
    act(() => {
      vi.advanceTimersByTime(MS - 1);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  // Cada sinal de vida reinicia a contagem. Sem isso, quem passa uma hora
  // montando um roteiro seria deslogado no meio do trabalho.
  it.each(IDLE_EVENTS)("reinicia a contagem em %s", (evento) => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ ms: MS, onIdle }));

    act(() => {
      vi.advanceTimersByTime(MS - 1_000);
    });
    activity(evento);
    act(() => {
      vi.advanceTimersByTime(MS - 1_000);
    });
    expect(onIdle).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onIdle).toHaveBeenCalledOnce();
  });

  // Uma vez só: depois de encerrar a sessão, um evento tardio não pode disparar
  // um segundo logout em cima do redirecionamento que já está acontecendo.
  it("não chama duas vezes", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ ms: MS, onIdle }));
    act(() => {
      vi.advanceTimersByTime(MS * 3);
    });
    expect(onIdle).toHaveBeenCalledOnce();
  });

  it("desligado não conta nada", () => {
    const onIdle = vi.fn();
    renderHook(() => useIdleTimer({ ms: MS, onIdle, enabled: false }));
    act(() => {
      vi.advanceTimersByTime(MS * 2);
    });
    expect(onIdle).not.toHaveBeenCalled();
  });

  it("solta os ouvintes ao desmontar", () => {
    const onIdle = vi.fn();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useIdleTimer({ ms: MS, onIdle }));
    unmount();

    for (const evento of IDLE_EVENTS) {
      expect(remove).toHaveBeenCalledWith(evento, expect.any(Function));
    }
    act(() => {
      vi.advanceTimersByTime(MS * 2);
    });
    expect(onIdle).not.toHaveBeenCalled();
    remove.mockRestore();
  });
});
