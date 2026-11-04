"use client";

import { useEffect, useState } from "react";

// Porta de entrada da landing para o app. Sem sessão: "Entrar". Com sessão no
// browser: "Minhas viagens". Até a leitura resolver, mostra "Entrar" — a
// página inteira nunca fica esperando o Supabase. O SDK (~60 kB) entra por
// import dinâmico: fica fora do JS inicial das páginas públicas.
export default function AppEntry() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void import("../../lib/supabase")
      .then(({ getSupabaseBrowserClient }) => getSupabaseBrowserClient().auth.getSession())
      .then(({ data }) => setSignedIn(data.session !== null))
      .catch(() => setSignedIn(false));
  }, []);

  return signedIn ? <a href="/trips">Minhas viagens</a> : <a href="/login">Entrar</a>;
}
