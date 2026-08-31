"use client";

import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";
import { fetchWaitlistCount, submitWaitlist } from "../lib/waitlist";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Status = "idle" | "sending" | "ok" | "error";

function WaitlistForm({ source, onJoined }: { source: string; onJoined: () => void }) {
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

function Shot({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="shot" aria-hidden="true">
      <div className="shot-bar">
        <i />
        <i />
        <i />
        <span>{url}</span>
      </div>
      {children}
    </div>
  );
}

const MiniSide = ({ dest }: { dest: string }) => (
  <aside className="mini-side">
    <div className="lg">
      Farol<i>.</i>
    </div>
    <div className="kv">
      Origem <b>São Paulo · GRU</b>
    </div>
    <div className="kv">
      Datas <b>10 – 17 mai</b>
    </div>
    <div className="kv">
      {dest}
    </div>
    <div className="mini-step done">
      <span className="dot" />
      Perfil de gosto
    </div>
    <div className="mini-step done">
      <span className="dot" />
      Escolher destino
    </div>
    <div className="mini-step on">
      <span className="dot" />
      Roteiro
    </div>
    <div className="mini-step">
      <span className="dot" />
      Voo &amp; hotel
    </div>
  </aside>
);

function ShotOnboarding() {
  return (
    <Shot url="farol.app/onboarding">
      <div className="ob">
        <div className="prog">
          <i />
        </div>
        <h4>O que te move numa viagem?</h4>
        <p className="obsub">Escolha ao menos 3. Isso ajusta destino e roteiro.</p>
        <div className="ob-grid">
          <div className="ob-tile on">Praia</div>
          <div className="ob-tile on">Gastronomia</div>
          <div className="ob-tile">Cultura</div>
          <div className="ob-tile on">Natureza</div>
          <div className="ob-tile">Vida noturna</div>
          <div className="ob-tile">Compras</div>
        </div>
        <div className="ob-field">Ritmo da viagem</div>
        <div className="ob-seg">
          <span>Relaxado</span>
          <span className="on">Moderado</span>
          <span>Intenso</span>
        </div>
        <div>
          <span className="ob-cta">Continuar →</span>
        </div>
      </div>
    </Shot>
  );
}

function ShotDiscovery() {
  return (
    <Shot url="farol.app/viagem/descoberta">
      <div className="mini">
        <MiniSide dest="Gostos · Praia · gastronomia" />
        <div className="mini-main">
          <h4 className="mini-h">4 destinos pra você</h4>
          <p className="mini-sub">Ordenados por aderência ao seu perfil. Custo para 2 pessoas.</p>
          <div className="dgrid">
            <div className="dcard top">
              <div className="ph ph-a">
                <span className="bdg">94%</span>
              </div>
              <div className="bd">
                <div className="ct">Cartagena</div>
                <div className="cy">Colômbia</div>
                <div className="mb">
                  <i style={{ width: "94%" }} />
                </div>
                <p className="rt">
                  Praia e um centro histórico que já é um roteiro gastronômico. Maio é seco.
                </p>
                <div className="st">
                  <span>
                    <b>31°</b> seco
                  </span>
                  <span>
                    <b>5h</b> direto
                  </span>
                  <span>
                    <b>R$ 4,1k</b>
                  </span>
                </div>
              </div>
            </div>
            <div className="dcard">
              <div className="ph ph-b">
                <span className="bdg">85%</span>
              </div>
              <div className="bd">
                <div className="ct">Lisboa</div>
                <div className="cy">Portugal</div>
                <div className="mb">
                  <i style={{ width: "85%" }} />
                </div>
                <p className="rt">
                  Clima ameno, ladeiras históricas e praia a 30 minutos quando bater vontade.
                </p>
                <div className="st">
                  <span>
                    <b>21°</b> ameno
                  </span>
                  <span>
                    <b>9h30</b> direto
                  </span>
                  <span>
                    <b>R$ 5,6k</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside className="mini-rail">
          <div className="rlbl">Assessor</div>
          <span className="mb-bub a">Cartagena lidera: praia e gastronomia no mesmo lugar.</span>
          <span className="mb-bub u">o de Lisboa cabe no orçamento?</span>
          <span className="mb-bub a">No limite — uns R$ 600 acima. Dá pra fechar cortando 1 noite.</span>
        </aside>
      </div>
    </Shot>
  );
}

function ShotItinerary() {
  return (
    <Shot url="farol.app/viagem/roteiro">
      <div className="mini">
        <MiniSide dest="Destino · Cartagena, Colômbia" />
        <div className="mini-main">
          <h4 className="mini-h">Cartagena · 7 dias</h4>
          <p className="mini-sub">10 – 17 de maio · ritmo moderado · praia e gastronomia</p>
          <div className="daystrip-mini">
            <span className="on">Dia 1</span>
            <span>Dia 2</span>
            <span>Dia 3</span>
            <span>Dia 4</span>
            <span>Dia 5</span>
            <span>Dia 6</span>
            <span>Dia 7</span>
          </div>
          <div className="day-h">
            <h4>Dia 1 — Chegada e Cidade Amuralhada</h4>
            <span className="chip">31° ensolarado</span>
            <span className="chip">R$ 210 no dia</span>
          </div>
          <div className="tl-entry">
            <span className="tm">09:00</span>
            <div className="tl-card">
              <span className="tl-thumb" />
              <div>
                <div className="nm">Cidade Amuralhada a pé</div>
                <div className="mt">Centro histórico · comece cedo para evitar o calor.</div>
                <div className="tgs">
                  <span>Passeio</span>
                  <span>~2h</span>
                  <span>Grátis</span>
                </div>
              </div>
            </div>
          </div>
          <div className="tl-entry">
            <span className="tm">12:30</span>
            <div className="tl-card">
              <span className="tl-thumb t2" />
              <div>
                <div className="nm">Almoço — La Cevichería</div>
                <div className="mt">Frutos do mar · chegar antes das 13h.</div>
                <div className="tgs">
                  <span>Restaurante</span>
                  <span>$$</span>
                  <span>4.5 ★</span>
                </div>
              </div>
            </div>
          </div>
          <div className="tl-entry">
            <span className="tm">15:00</span>
            <div className="tl-card">
              <span className="tl-thumb t3" />
              <div>
                <div className="nm">Praia de Bocagrande</div>
                <div className="mt">Tarde livre à beira-mar.</div>
                <div className="tgs">
                  <span>Praia</span>
                  <span>Livre</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside className="mini-rail">
          <div className="rlbl">Assessor</div>
          <span className="mb-bub u">tira o dia de museu e põe mais praia</span>
          <span className="mb-bub a">Feito — o Dia 4 virou praia com passeio de barco. Custo do dia caiu R$ 120.</span>
        </aside>
      </div>
    </Shot>
  );
}

function ShotFlights() {
  return (
    <Shot url="farol.app/viagem/voo-hotel">
      <div className="mini">
        <MiniSide dest="Roteiro · 7 dias montados" />
        <div className="mini-main">
          <h4 className="mini-h">Voo &amp; hotel</h4>
          <p className="mini-sub">GRU → CTG · 10 – 17 mai. A reserva é concluída no site do parceiro.</p>
          <div className="mini-tabs">
            <span className="on">Voos</span>
            <span>Hotéis</span>
          </div>
          <div className="offer-mini best">
            <span className="al">AV</span>
            <span className="rt2">
              08:15 → 13:40
              <small>GRU → CTG · direto · 5h25</small>
            </span>
            <span className="pr">
              R$ 2.140
              <small>ou ~92k milhas</small>
            </span>
          </div>
          <div className="offer-mini">
            <span className="al">LA</span>
            <span className="rt2">
              10:50 → 18:05
              <small>GRU → CTG · 1 escala · BOG</small>
            </span>
            <span className="pr">
              R$ 1.980
              <small>ou ~78k milhas</small>
            </span>
          </div>
          <p className="fresh-mini">Preços atualizados há 8 min · confirmados no site do parceiro.</p>
          <div className="hgrid">
            <div className="hcard-mini">
              <div className="hph" />
              <div className="hb">
                <div className="hn">Casa del Arzobispado</div>
                <div className="ha">Centro Histórico</div>
                <div className="hr">
                  <span className="rate">4.7 ★</span>
                  <span>R$ 320</span>
                </div>
              </div>
            </div>
            <div className="hcard-mini">
              <div className="hph h2" />
              <div className="hb">
                <div className="hn">Hotel Getsemaní 24</div>
                <div className="ha">Perto da vida noturna</div>
                <div className="hr">
                  <span className="rate">4.5 ★</span>
                  <span>R$ 240</span>
                </div>
              </div>
            </div>
            <div className="hcard-mini">
              <div className="hph h3" />
              <div className="hb">
                <div className="hn">Bocagrande Mar</div>
                <div className="ha">Pé na areia</div>
                <div className="hr">
                  <span className="rate">4.4 ★</span>
                  <span>R$ 280</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside className="mini-rail">
          <div className="rlbl">Assessor</div>
          <span className="mb-bub a">O direto da Avianca chega a tempo do almoço do Dia 1.</span>
          <span className="mb-bub u">tem algo mais barato saindo sábado?</span>
        </aside>
      </div>
    </Shot>
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
            <p className="count">
              {count} pessoa{count === 1 ? "" : "s"} já na lista.
            </p>
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
          <p className="eyebrow">A experiência, tela por tela</p>
          <p className="lead">
            Do gosto ao roteiro pronto, sem sair de uma conversa. As telas abaixo são do
            protótipo — nomes de lugares e preços são exemplos.
          </p>
          <div className="exp">
            <figure>
              <ShotOnboarding />
              <figcaption>
                <span className="step-n">01</span>
                <h3>Conta o gosto</h3>
                <p>
                  Ritmo, companhia, orçamento e o que você curte. Sem formulário infinito — o
                  resto o Farol infere.
                </p>
              </figcaption>
            </figure>

            <figure>
              <ShotDiscovery />
              <figcaption>
                <span className="step-n">02</span>
                <h3>Recebe destinos com o porquê</h3>
                <p>
                  Uma lista curta, ordenada por aderência. Cada um vem com clima, tempo de voo
                  e custo estimado — e o assessor no trilho lateral explica a escolha.
                </p>
              </figcaption>
            </figure>

            <figure>
              <ShotItinerary />
              <figcaption>
                <span className="step-n">03</span>
                <h3>Vê o roteiro dia a dia</h3>
                <p>
                  Manhã, tarde e noite montadas, com margem para respirar. “Menos museu, mais
                  praia” no chat e o dia se refaz na hora.
                </p>
              </figcaption>
            </figure>

            <figure>
              <ShotFlights />
              <figcaption>
                <span className="step-n">04</span>
                <h3>Voo e hotel, com link pro parceiro</h3>
                <p>
                  As melhores opções para as suas datas, em dinheiro (e milhas, depois). A
                  compra é concluída no site do parceiro — o Farol não fecha a reserva.
                </p>
              </figcaption>
            </figure>
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
            <p className="count">
              {count} pessoa{count === 1 ? "" : "s"} já na lista.
            </p>
          ) : null}
        </section>
      </main>

      <footer className="wrap">Farol · assessor de viagem · nome de trabalho</footer>
    </>
  );
}
