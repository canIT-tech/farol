"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../lib/supabase";
import "./sidebar.css";

// Garante uma sessão do Supabase antes de renderizar a área logada.
// Passa o access_token para os filhos usarem no apiFetch.
export function AuthGate({ children }: { children: (token: string) => ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token ?? null;
      if (accessToken === null) {
        router.replace("/login");
      } else {
        setToken(accessToken);
      }
      setReady(true);
    });
  }, [router]);

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
