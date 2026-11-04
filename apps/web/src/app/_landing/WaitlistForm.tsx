"use client";

import { type FormEvent, useState } from "react";
import { submitWaitlist } from "../../lib/waitlist";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "sending" | "ok" | "error";

export default function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("error");
      setMessage("Confere o e-mail — parece incompleto.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const result = await submitWaitlist(value, source);
      setStatus("ok");
      setMessage(
        result.created
          ? "A gente avisa quando abrir o acesso."
          : "Esse e-mail já estava na lista — a gente avisa quando abrir."
      );
      setEmail(value);
    } catch {
      setStatus("error");
      setMessage("Não deu para salvar agora. Tenta de novo em instantes.");
    }
  }

  if (status === "ok") {
    return (
      <div className="signup-done" role="status">
        <strong>Você está na lista.</strong>
        <p>
          {message} Guardamos <b>{email}</b>.
        </p>
      </div>
    );
  }

  return (
    <form
      className="signup"
      onSubmit={onSubmit}
      aria-label="Entrar na lista de espera"
      noValidate
    >
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="seu@email.com"
        aria-label="E-mail"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : "Quero ser dos primeiros"}
      </button>
      <p className="note" data-tone={status === "error" ? "error" : undefined} role="status">
        {message}
      </p>
    </form>
  );
}
