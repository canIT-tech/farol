"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { fetchWaitlistCount, submitWaitlist } from "../lib/waitlist";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "sending" | "ok" | "error";

function WaitlistForm({
  source,
  onJoined
}: {
  source: string;
  onJoined: () => void;
}) {
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
          ? "Pronto. Você está na lista — a gente avisa quando abrir."
          : "Esse e-mail já estava na lista. A gente avisa quando abrir."
      );
      setEmail("");
      if (result.created) onJoined();
    } catch {
      setStatus("error");
      setMessage("Não deu para salvar agora. Tenta de novo em instantes.");
    }
  }

  const tone = status === "ok" ? "ok" : status === "error" ? "error" : undefined;

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
      <p className="note" data-tone={tone} role="status">
        {message}
      </p>
    </form>
  );
}

export default function HomePage() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchWaitlistCount()
      .then((c) => {
        if (active) setCount(c.count);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const bumpCount = useCallback(() => {
    setCount((current) => (current === null ? current : current + 1));
  }, []);

  return (
    <>
      <header className="wrap topbar">
        <span className="brand">Farol</span>
        <span className="tag">assessor de viagem · em construção</span>
      </header>

      <main>
        <section className="hero wrap">
          <p className="eyebrow">Lista de primeiros usuários</p>
          <h1>Você não precisa saber para onde ir.</h1>
          <p className="sub">
            O Farol parte do seu gosto, acha o destino, monta o dia a dia e ajusta tudo por
            conversa. Ainda estamos construindo — deixe seu e-mail para ser dos primeiros a
            testar.
          </p>
          <WaitlistForm source="landing-hero" onJoined={bumpCount} />
          {count !== null ? (
            <p className="count">{count} pessoa{count === 1 ? "" : "s"} já na lista.</p>
          ) : null}
        </section>

        <section className="wrap">
          <p className="eyebrow">O problema</p>
          <p className="lead">
            Trinta abas abertas, três planilhas, e a viagem continua no “quem sabe”. Planejar
            devia ser a parte boa — quase nunca é.
          </p>
        </section>

        <section className="wrap">
          <p className="eyebrow">Como funciona</p>
          <ol className="steps">
            <li>
              <h3>Conta o gosto</h3>
              <p>Ritmo, companhia, orçamento e o que você curte. Sem formulário infinito.</p>
            </li>
            <li>
              <h3>Recebe o destino</h3>
              <p>
                Uma lista curta com o porquê de cada um — clima, custo estimado, tempo de voo.
              </p>
            </li>
            <li>
              <h3>Vê o roteiro</h3>
              <p>Dia a dia montado, com margem para respirar. Nada de agenda militar.</p>
            </li>
            <li>
              <h3>Ajusta conversando</h3>
              <p>“Menos museu, mais praia” e o plano se refaz na hora.</p>
            </li>
          </ol>
        </section>

        <section className="wrap">
          <p className="eyebrow">Ajuste por conversa</p>
          <p className="lead">Você fala com o Farol como falaria com um amigo que viaja muito.</p>
          <div className="adjust-grid">
            <div className="chat">
              <span className="bubble you">Tem algo mais tranquilo que Lisboa?</span>
              <span className="bubble farol">
                Porto encaixa melhor no seu ritmo: mesma comida e vinho, metade da agitação.
                Troco o destino?
              </span>
              <span className="bubble you">Troca.</span>
            </div>
            <div className="card">
              <h3>Porto</h3>
              <p className="place">Portugal · voo ~10h de GRU</p>
              <span className="match">82% de aderência ao seu gosto</span>
              <ul>
                <li>Ritmo tranquilo, caminhável</li>
                <li>Gastronomia e vinho no centro do roteiro</li>
                <li>Custo estimado 15% abaixo do seu teto</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="wrap">
          <p className="eyebrow">Preços (planejado)</p>
          <p className="lead">Sem assinatura. Você paga pela viagem que montar.</p>
          <div className="pay">
            <div>
              <h3>Grátis</h3>
              <p className="price">R$ 0</p>
              <small>Uma viagem, um destino, modo autônomo. Sem chat.</small>
            </div>
            <div>
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

        <section className="honest wrap">
          <p className="eyebrow">Honesto sobre o que ainda não faz</p>
          <p className="lead">O Farol assume o trabalho, mas não finge saber o que não sabe.</p>
          <ul>
            <li>Não reserva voo nem hotel por você — leva até a página de compra.</li>
            <li>Comparação com milhas vem depois do lançamento inicial.</li>
            <li>Roteiro é ponto de partida forte, não palavra final.</li>
          </ul>
        </section>

        <section className="wrap">
          <p className="eyebrow">Lista de primeiros usuários</p>
          <h1 style={{ fontSize: "clamp(1.8rem, 1.4rem + 2vw, 2.6rem)" }}>
            Entre agora e teste antes de todo mundo.
          </h1>
          <WaitlistForm source="landing-footer" onJoined={bumpCount} />
          {count !== null ? (
            <p className="count">{count} pessoa{count === 1 ? "" : "s"} já na lista.</p>
          ) : null}
        </section>
      </main>

      <footer className="wrap">Farol · assessor de viagem · nome de trabalho</footer>
    </>
  );
}
