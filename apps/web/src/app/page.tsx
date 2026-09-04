"use client";

import { type FormEvent, useState } from "react";
import { submitWaitlist } from "../lib/waitlist";
import AppEntry from "./_landing/AppEntry";
import ChatDemo from "./_landing/ChatDemo";
import Modes from "./_landing/Modes";
import Screens from "./_landing/Screens";
import TasteDemo from "./_landing/TasteDemo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "sending" | "ok" | "error";

function WaitlistForm({ source }: { source: string }) {
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

export default function HomePage() {
  return (
    <div className="landing">
      <nav className="nav">
        <div className="wrap nav-inner">
          <span className="brand">Farol</span>
          <div className="nav-links">
            <a href="#experiencia">Como funciona</a>
            <a href="#precos">Preços</a>
            <AppEntry />
            <a href="#lista" className="nav-cta">
              Entrar na lista
            </a>
          </div>
        </div>
      </nav>

      <main>
        <section className="hero wrap" id="lista">
          <p className="eyebrow">Lista de primeiros usuários</p>
          <h1>Você não precisa saber para onde ir.</h1>
          <p className="deck">
            O Farol parte do seu gosto, acha o destino, monta o dia a dia e ajusta tudo por
            conversa. Ainda estamos construindo — entre na lista e teste antes de todo mundo.
          </p>
          <WaitlistForm source="landing-hero" />
          <p className="trust">Sem spam. Um único e-mail quando abrir o acesso.</p>
        </section>

        <section className="band-dark" id="experimente">
          <div className="wrap reveal">
            <p className="eyebrow">Experimente agora</p>
            <h2 className="h2">Escolha o que você curte. O Farol devolve um destino com o porquê.</h2>
            <p className="lead">
              É o mesmo motor do produto, com dados de exemplo. Toque nos gostos e veja o
              resultado mudar.
            </p>
            <TasteDemo />
          </div>
        </section>

        <section className="wrap reveal" id="experiencia">
          <p className="eyebrow">A experiência, tela por tela</p>
          <h2 className="h2">Percorra o fluxo como quem já está usando.</h2>
          <p className="lead">
            Escolha o que te move e o ritmo, siga para os destinos, abra um roteiro. É o
            caminho real do app, aqui na página.
          </p>
          <Screens />
        </section>

        <section className="wrap reveal">
          <p className="eyebrow">Ajuste por conversa</p>
          <h2 className="h2">Mudou de ideia? O plano se refaz — você não recomeça.</h2>
          <p className="lead">
            Clique num pedido e acompanhe o roteiro à direita mudar na hora.
          </p>
          <ChatDemo />
        </section>

        <section className="wrap reveal">
          <p className="eyebrow">Dois jeitos de usar</p>
          <h2 className="h2">Do controle total ao “decide por mim”.</h2>
          <Modes />
        </section>

        <section className="wrap reveal" id="precos">
          <p className="eyebrow">Preços (planejado)</p>
          <h2 className="h2">Sem assinatura. Você paga a viagem que montar.</h2>
          <div className="pay">
            <div>
              <h3>Grátis</h3>
              <p className="price">R$ 0</p>
              <small>Uma viagem, um destino, modo autônomo. Sem chat.</small>
            </div>
            <div className="feature">
              <h3>Viagem</h3>
              <p className="price">R$ 39</p>
              <small>Produto completo com chat de ajuste. Pagamento único.</small>
            </div>
            <div>
              <h3>Pacote 3 viagens</h3>
              <p className="price">R$ 89</p>
              <small>Para quem já sabe que vai planejar mais de uma.</small>
            </div>
          </div>
        </section>

        <section className="honest">
          <div className="wrap reveal">
            <p className="eyebrow">Honesto sobre o que ainda não faz</p>
            <h2 className="h2">O Farol assume o trabalho — não finge saber o que não sabe.</h2>
            <ul>
              <li>Não reserva voo nem hotel por você — leva até a página de compra do parceiro.</li>
              <li>Comparação com milhas vem depois do lançamento inicial.</li>
              <li>O roteiro é um ponto de partida forte, não a palavra final.</li>
            </ul>
          </div>
        </section>

        <section className="final wrap reveal">
          <p className="eyebrow">Lista de primeiros usuários</p>
          <h2>Entre agora e teste antes de todo mundo.</h2>
          <WaitlistForm source="landing-footer" />
        </section>
      </main>

      <footer className="wrap">Farol · assessor de viagem · nome de trabalho</footer>
    </div>
  );
}
