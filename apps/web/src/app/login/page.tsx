"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../lib/supabase";

// Depois de entrar a pessoa cai em /trips, que manda para o onboarding se ainda
// não houver perfil de gosto. Quem já tem sessão nem vê esta tela.
const AFTER_LOGIN = "/trips";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session !== null) router.replace(AFTER_LOGIN);
      });
  }, [router]);

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${AFTER_LOGIN}` }
    });
    if (err) setError(err.message);
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${AFTER_LOGIN}` }
    });
    if (err) setError(err.message);
    else setSent(true);
  }

  return (
    <main>
      <h1>Entrar no Farol</h1>

      <button type="button" onClick={signInWithGoogle}>
        Entrar com Google
      </button>

      <form onSubmit={signInWithEmail}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit">Enviar link mágico</button>
      </form>

      {sent ? <p role="status">Link enviado. Confira seu e-mail.</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
