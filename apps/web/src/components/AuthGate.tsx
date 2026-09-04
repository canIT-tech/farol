"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UNAUTHORIZED_EVENT } from "../lib/api-client";
import { useIdleTimer } from "../hooks/useIdleTimer";
import { getSupabaseBrowserClient } from "../lib/supabase";
import "./sidebar.css";

/** Silêncio até encerrar a sessão sozinho.
 *  Trava contra tela deixada aberta, não contra token roubado: a api é
 *  stateless e não sabe de inatividade. Quem fecha aquela janela é a validade
 *  curta do token, configurada no Supabase. */
export const IDLE_MS = 30 * 60_000;

const LOGIN = "/login";

/**
 * Garante uma sessão do Supabase antes de renderizar a área logada e entrega o
 * access_token corrente aos filhos.
 *
 * "Corrente" é o ponto: a versão anterior lia getSession() uma vez e passava
 * aquele token para sempre. O Supabase renova em segundo plano, então depois de
 * uma hora o app seguia mandando um token vencido e tomava 401 em tudo, sem
 * caminho de volta. Agora a fonte é o onAuthStateChange, que também avisa
 * quando a sessão termina em outra aba.
 */
export function AuthGate({ children }: { children: (token: string) => ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const apply = useCallback(
    (session: { access_token?: string } | null) => {
      const next = session?.access_token ?? null;
      setToken(next);
      setReady(true);
      if (next === null) {
        router.replace(LOGIN);
      }
    },
    [router]
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, [apply]);

  // Backstop: a api recusou a credencial mesmo com o Supabase achando que a
  // sessão está viva — relógio fora de sincronia, JWKS rotacionado, conta
  // apagada. Reconsultar decide entre um 401 passageiro e sessão morta, sem
  // derrubar quem ainda está logado.
  useEffect(() => {
    const recheck = () => {
      void getSupabaseBrowserClient()
        .auth.getSession()
        .then(({ data }) => apply(data.session));
    };
    window.addEventListener(UNAUTHORIZED_EVENT, recheck);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, recheck);
  }, [apply]);

  const signOutOnIdle = useCallback(() => {
    // O signOut emite SIGNED_OUT, e o ouvinte acima é quem redireciona — um
    // caminho só para sair, venha o fim da sessão de onde vier.
    void getSupabaseBrowserClient().auth.signOut();
  }, []);

  useIdleTimer({ ms: IDLE_MS, onIdle: signOutOnIdle, enabled: token !== null });

  if (!ready) {
    return (
      <p className="boot" role="status">
        Carregando…
      </p>
    );
  }
  if (token === null) {
    return null;
  }
  return <>{children(token)}</>;
}
