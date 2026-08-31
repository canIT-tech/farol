"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

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

function MiniSide({ dest }: { dest: string }) {
  return (
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
      <div className="kv">{dest}</div>
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
}

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
          <span className="mb-bub a">
            Feito — o Dia 4 virou praia com passeio de barco. Custo do dia caiu R$ 120.
          </span>
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
          <p className="mini-sub">
            GRU → CTG · 10 – 17 mai. A reserva é concluída no site do parceiro.
          </p>
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
          <p className="fresh-mini">
            Preços atualizados há 8 min · confirmados no site do parceiro.
          </p>
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

const STEPS = [
  {
    n: "01",
    title: "Conta o gosto",
    copy: "Ritmo, companhia, orçamento e o que você curte. Sem formulário infinito — o resto o Farol infere.",
    shot: <ShotOnboarding />
  },
  {
    n: "02",
    title: "Recebe destinos com o porquê",
    copy: "Uma lista curta, ordenada por aderência. Cada um com clima, tempo de voo e custo estimado — e o assessor explica a escolha.",
    shot: <ShotDiscovery />
  },
  {
    n: "03",
    title: "Vê o roteiro dia a dia",
    copy: "Manhã, tarde e noite montadas, com margem para respirar. Um pedido no chat e o dia se refaz na hora.",
    shot: <ShotItinerary />
  },
  {
    n: "04",
    title: "Voo e hotel, com link pro parceiro",
    copy: "As melhores opções para as suas datas, em dinheiro — e milhas, depois. A compra fecha no site do parceiro.",
    shot: <ShotFlights />
  }
];

export default function Screens() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number((entry.target as HTMLElement).dataset.idx);
            setActive(idx);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    for (const el of refs.current) {
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  const current = STEPS[active] ?? STEPS[0]!;

  return (
    <div className="walk">
      <div className="walk-copy" aria-hidden="true">
        <span className="step-n">{current.n}</span>
        <h3>{current.title}</h3>
        <p>{current.copy}</p>
        <div className="dots">
          {STEPS.map((step, i) => (
            <i key={step.n} className={i === active ? "on" : undefined} />
          ))}
        </div>
      </div>

      <div className="walk-shots">
        {STEPS.map((step, i) => (
          <figure
            key={step.n}
            data-idx={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
          >
            <figcaption>
              <span className="step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </figcaption>
            {step.shot}
          </figure>
        ))}
      </div>
    </div>
  );
}
