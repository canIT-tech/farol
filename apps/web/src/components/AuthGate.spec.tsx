import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthGate, IDLE_MS } from "./AuthGate";
import { UNAUTHORIZED_EVENT } from "../lib/api-client";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

// Fake do supabase-js: guarda o ouvinte de onAuthStateChange para os testes
// empurrarem eventos (renovação, logout em outra aba) como o SDK faria.
let listener: ((event: string, session: unknown) => void) | null = null;
let sessionNow: unknown = { access_token: "tok-1" };
const unsubscribe = vi.fn();
const signOut = vi.fn(async () => {
  sessionNow = null;
  listener?.("SIGNED_OUT", null);
  return { error: null };
});
const getSession = vi.fn(async () => ({ data: { session: sessionNow } }));

vi.mock("../lib/supabase", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession,
      signOut,
      onAuthStateChange: (fn: (e: string, s: unknown) => void) => {
        listener = fn;
        return { data: { subscription: { unsubscribe } } };
      }
    }
  })
}));

beforeEach(() => {
  replace.mockClear();
  unsubscribe.mockClear();
  signOut.mockClear();
  listener = null;
  sessionNow = { access_token: "tok-1" };
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
});

const mostrar = () => <AuthGate>{(token) => <p>token: {token}</p>}</AuthGate>;

describe("AuthGate", () => {
  it("entrega o token da sessão aos filhos", async () => {
    render(mostrar());
    expect(await screen.findByText("token: tok-1")).toBeInTheDocument();
  });

  it("manda para o login quando não há sessão", async () => {
    sessionNow = null;
    render(mostrar());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText(/^token:/)).not.toBeInTheDocument();
  });

  // O buraco que motivou tudo: o token era fotografado na montagem e usado para
  // sempre. O Supabase renova em segundo plano; sem escutar, o app seguia com o
  // token velho e passava a tomar 401 depois de uma hora.
  it("passa a usar o token novo quando a sessão é renovada", async () => {
    render(mostrar());
    await screen.findByText("token: tok-1");

    act(() => {
      listener?.("TOKEN_REFRESHED", { access_token: "tok-2" });
    });
    expect(await screen.findByText("token: tok-2")).toBeInTheDocument();
  });

  it("cai no login quando a sessão termina em outra aba", async () => {
    render(mostrar());
    await screen.findByText("token: tok-1");

    act(() => {
      listener?.("SIGNED_OUT", null);
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("larga a assinatura ao desmontar", async () => {
    const { unmount } = render(mostrar());
    await screen.findByText("token: tok-1");
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("encerra a sessão depois do tempo de inatividade", async () => {
    render(mostrar());
    await screen.findByText("token: tok-1");

    act(() => {
      vi.advanceTimersByTime(IDLE_MS);
    });
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("não encerra enquanto há atividade", async () => {
    render(mostrar());
    await screen.findByText("token: tok-1");

    act(() => {
      vi.advanceTimersByTime(IDLE_MS - 1_000);
      window.dispatchEvent(new Event("keydown"));
      vi.advanceTimersByTime(IDLE_MS - 1_000);
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  // Backstop: a api recusou a credencial mesmo com o Supabase achando que a
  // sessão está viva — relógio fora de sincronia, JWKS rotacionado, usuário
  // apagado. Reconsulta antes de decidir; sessão de fato morta leva ao login.
  it("reconsulta a sessão quando a api responde 401", async () => {
    render(mostrar());
    await screen.findByText("token: tok-1");
    getSession.mockClear();
    sessionNow = null;

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("segue em frente se o 401 foi passageiro e a sessão continua de pé", async () => {
    render(mostrar());
    await screen.findByText("token: tok-1");
    replace.mockClear();

    act(() => {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("token: tok-1")).toBeInTheDocument();
  });
});
