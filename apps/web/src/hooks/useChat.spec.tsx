import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";

function respond(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

const reply = {
  message: { role: "assistant", content: "Tirei o museu do dia 2." },
  tripState: {}
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useChat", () => {
  it("guarda a pergunta e a resposta na ordem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(reply)));
    const { result } = renderHook(() => useChat("tok", TRIP_ID, vi.fn()));

    await act(async () => {
      await result.current.send("tira o museu");
    });

    expect(result.current.messages).toEqual([
      { id: "u0", role: "user", content: "tira o museu" },
      { id: "a1", role: "assistant", content: "Tirei o museu do dia 2." }
    ]);
  });

  it("usa o id da mensagem quando a api manda um", async () => {
    const id = "99999999-9999-4999-8999-999999999999";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond({ ...reply, message: { ...reply.message, id } }))
    );
    const { result } = renderHook(() => useChat("tok", TRIP_ID, vi.fn()));
    await act(async () => {
      await result.current.send("oi");
    });
    expect(result.current.messages[1]!.id).toBe(id);
  });

  it("conteúdo nulo vira string vazia", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond({ ...reply, message: { role: "assistant", content: null } }))
    );
    const { result } = renderHook(() => useChat("tok", TRIP_ID, vi.fn()));
    await act(async () => {
      await result.current.send("oi");
    });
    expect(result.current.messages[1]!.content).toBe("");
  });

  it("avisa a tela para reler o estado da viagem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respond(reply)));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useChat("tok", TRIP_ID, onChanged));
    await act(async () => {
      await result.current.send("tira o museu");
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("marca pending durante a chamada", async () => {
    let resolver: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (resolver = resolve)))
    );
    const { result } = renderHook(() => useChat("tok", TRIP_ID, vi.fn()));
    act(() => {
      void result.current.send("oi");
    });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => {
      resolver(respond(reply));
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("erro vira mensagem e mantém a pergunta na tela", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    const { result } = renderHook(() => useChat("tok", TRIP_ID, vi.fn()));
    await act(async () => {
      await result.current.send("oi");
    });
    expect(result.current.error).toContain("503");
    expect(result.current.messages).toHaveLength(1);
  });

  it("erro não-Error vira mensagem genérica", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw "pane";
      })
    );
    const { result } = renderHook(() => useChat("tok", TRIP_ID, vi.fn()));
    await act(async () => {
      await result.current.send("oi");
    });
    expect(result.current.error).toBe("não consegui falar com o assessor");
  });
});
