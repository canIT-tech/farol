"use client";

import { type FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/onboarding` }
    });
    if (err) setError(err.message);
  }

  async function signInWithEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` }
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
