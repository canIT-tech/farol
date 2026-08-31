"use client";

import { type ReactNode, useMemo, useState } from "react";
import { type Ranked, rankDestinations } from "./destinations";

const STEP_LABELS = ["Perfil de gosto", "Escolher destino", "Roteiro", "Voo & hotel"];

const ONB_TASTES: Array<{ id: string; label: string }> = [
  { id: "praia", label: "Praia" },
  { id: "gastronomia", label: "Gastronomia" },
  { id: "cultura", label: "Cultura" },
  { id: "natureza", label: "Natureza" },
  { id: "noturna", label: "Vida noturna" },
  { id: "compras", label: "Compras" }
];

const PACES: Array<{ id: string; label: string }> = [
  { id: "relaxado", label: "Relaxado" },
  { id: "moderado", label: "Moderado" },
  { id: "intenso", label: "Intenso" }
];

function Shot({
  url,
  interactive,
  children
}: {
  url: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="shot" aria-hidden={interactive ? undefined : true}>
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

function MiniSide({ dest, step }: { dest: string; step: number }) {
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
      {STEP_LABELS.map((label, i) => (
        <div
          key={label}
          className={`mini-step ${i < step ? "done" : ""} ${i === step ? "on" : ""}`}
        >
          <span className="dot" />
          {label}
        </div>
      ))}
    </aside>
  );
}

function StageOnboarding({
  interests,
  pace,
  onToggle,
  onPace
}: {
  interests: string[];
  pace: string;
  onToggle: (id: string) => void;
  onPace: (id: string) => void;
}) {
  return (
    <Shot url="farol.app/onboarding" interactive>
      <div className="ob">
        <div className="prog">
          <i style={{ width: "25%" }} />
        </div>
        <h4>O que te move numa viagem?</h4>
        <p className="obsub">Escolha o que curte e o ritmo. Isso ajusta destino e roteiro.</p>
        <div className="ob-grid">
          {ONB_TASTES.map((taste) => (
            <button
              key={taste.id}
              type="button"
              className={`ob-tile ${interests.includes(taste.id) ? "on" : ""}`}
              aria-pressed={interests.includes(taste.id)}
              onClick={() => onToggle(taste.id)}
            >
              {taste.label}
            </button>
          ))}
        </div>
        <div className="ob-field">Ritmo da viagem</div>
        <div className="ob-seg" role="radiogroup" aria-label="Ritmo da viagem">
          {PACES.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={pace === option.id}
              className={pace === option.id ? "on" : ""}
              onClick={() => onPace(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </Shot>
  );
}

function StageDiscovery({
  results,
  pickIndex,
  gostos,
  onPick
}: {
  results: Ranked[];
  pickIndex: number;
  gostos: string;
  onPick: (index: number) => void;
}) {
  const top = results.slice(0, 3);
  const leader = top[0];
  return (
    <Shot url="farol.app/viagem/descoberta" interactive>
      <div className="mini">
        <MiniSide dest={`Gostos · ${gostos}`} step={1} />
        <div className="mini-main">
          <h4 className="mini-h">Destinos pra você</h4>
          <p className="mini-sub">Ordenados por aderência ao seu perfil. Toque para ver o roteiro.</p>
          <div className="dgrid">
            {top.map((row, i) => (
              <button
                key={row.dest.city}
                type="button"
                className={`dcard flow-pick ${i === 0 ? "top" : ""} ${i === pickIndex ? "picked" : ""}`}
                onClick={() => onPick(i)}
              >
                <div className="ph" style={{ background: row.dest.photo }}>
                  <span className="bdg">{row.score}%</span>
                </div>
                <div className="bd">
                  <div className="ct">{row.dest.city}</div>
                  <div className="cy">{row.dest.country}</div>
                  <div className="mb">
                    <i style={{ width: `${row.score}%` }} />
                  </div>
                  <p className="rt">{row.dest.why}</p>
                  <div className="st">
                    <span>
                      <b>{row.dest.tempValue}</b> {row.dest.tempLabel}
                    </span>
                    <span>
                      <b>{row.dest.flightValue}</b> {row.dest.flightLabel}
                    </span>
                    <span>
                      <b>{row.dest.cost}</b>
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <aside className="mini-rail">
          <div className="rlbl">Assessor</div>
          <span className="mb-bub a">
            {leader ? `${leader.dest.city} lidera pelo seu gosto.` : "Escolha um gosto para eu buscar."}
          </span>
          <span className="mb-bub a">Toque num card e eu monto o roteiro.</span>
        </aside>
      </div>
    </Shot>
  );
}

function StageItinerary({
  city,
  temp,
  paceLabel,
  gostos
}: {
  city: string;
  temp: string;
  paceLabel: string;
  gostos: string;
}) {
  return (
    <Shot url="farol.app/viagem/roteiro">
      <div className="mini">
        <MiniSide dest={`Destino · ${city}`} step={2} />
        <div className="mini-main">
          <h4 className="mini-h">{city} · 7 dias</h4>
          <p className="mini-sub">
            10 – 17 de maio · ritmo {paceLabel.toLowerCase()} · foco em {gostos.toLowerCase()}
          </p>
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
            <h4>Dia 1 — Chegada e primeiro passeio</h4>
            <span className="chip">{temp}</span>
            <span className="chip">R$ 210 no dia</span>
          </div>
          <div className="tl-entry">
            <span className="tm">09:00</span>
            <div className="tl-card">
              <span className="tl-thumb" />
              <div>
                <div className="nm">Caminhada pelo centro histórico</div>
                <div className="mt">Comece cedo, antes do movimento e do calor.</div>
                <div className="tgs">
                  <span>Passeio</span>
                  <span>~2h</span>
                </div>
              </div>
            </div>
          </div>
          <div className="tl-entry">
            <span className="tm">12:30</span>
            <div className="tl-card">
              <span className="tl-thumb t2" />
              <div>
                <div className="nm">Almoço recomendado pelo Farol</div>
                <div className="mt">Cozinha local, bem avaliada e perto da caminhada.</div>
                <div className="tgs">
                  <span>Restaurante</span>
                  <span>$$</span>
                </div>
              </div>
            </div>
          </div>
          <div className="tl-entry">
            <span className="tm">15:00</span>
            <div className="tl-card">
              <span className="tl-thumb t3" />
              <div>
                <div className="nm">Tarde livre no ponto alto da cidade</div>
                <div className="mt">Espaço para descanso ou um passeio extra pelo chat.</div>
                <div className="tgs">
                  <span>Livre</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <aside className="mini-rail">
          <div className="rlbl">Assessor</div>
          <span className="mb-bub a">Montei 7 dias em {city}. Dia 1 mais leve para a chegada.</span>
          <span className="mb-bub u">tira o museu do Dia 4</span>
        </aside>
      </div>
    </Shot>
  );
}

function StageFlights({ city, cost }: { city: string; cost: string }) {
  return (
    <Shot url="farol.app/viagem/voo-hotel">
      <div className="mini">
        <MiniSide dest={`Roteiro · 7 dias montados`} step={3} />
        <div className="mini-main">
          <h4 className="mini-h">Voo &amp; hotel</h4>
          <p className="mini-sub">
            Voos para {city} · 10 – 17 mai. A reserva é concluída no site do parceiro.
          </p>
          <div className="mini-tabs">
            <span className="on">Voos</span>
            <span>Hotéis</span>
          </div>
          <div className="offer-mini best">
            <span className="al">AV</span>
            <span className="rt2">
              08:15 → 13:40
              <small>GRU → {city} · direto</small>
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
              <small>GRU → {city} · 1 escala</small>
            </span>
            <span className="pr">
              R$ 1.980
              <small>ou ~78k milhas</small>
            </span>
          </div>
          <p className="fresh-mini">
            Preços atualizados há 8 min · gasto total do roteiro estimado em {cost}.
          </p>
          <div className="hgrid">
            <div className="hcard-mini">
              <div className="hph" />
              <div className="hb">
                <div className="hn">Hotel bem posicionado</div>
                <div className="ha">A pé das primeiras paradas</div>
                <div className="hr">
                  <span className="rate">4.7 ★</span>
                  <span>R$ 320</span>
                </div>
              </div>
            </div>
            <div className="hcard-mini">
              <div className="hph h2" />
              <div className="hb">
                <div className="hn">Opção econômica</div>
                <div className="ha">Bairro central</div>
                <div className="hr">
                  <span className="rate">4.5 ★</span>
                  <span>R$ 240</span>
                </div>
              </div>
            </div>
            <div className="hcard-mini">
              <div className="hph h3" />
              <div className="hb">
                <div className="hn">Perto da orla</div>
                <div className="ha">Para os dias de praia</div>
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
          <span className="mb-bub a">O direto chega a tempo do almoço do Dia 1.</span>
          <span className="mb-bub u">tem algo mais barato saindo sábado?</span>
        </aside>
      </div>
    </Shot>
  );
}

export default function Screens() {
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(["praia", "gastronomia"]);
  const [pace, setPace] = useState("moderado");
  const [pickIndex, setPickIndex] = useState(0);

  const results = useMemo(() => {
    const ranked = rankDestinations(interests);
    return ranked.length > 0 ? ranked : rankDestinations(["praia", "gastronomia"]);
  }, [interests]);

  const chosen = results[Math.min(pickIndex, results.length - 1)] ?? results[0];
  const gostos = ONB_TASTES.filter((t) => interests.includes(t.id))
    .map((t) => t.label)
    .slice(0, 2)
    .join(" · ");
  const paceLabel = PACES.find((p) => p.id === pace)?.label ?? "Moderado";

  function toggleInterest(id: string) {
    setInterests((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  function goTo(target: number) {
    if (target <= step) setStep(target);
  }

  function next() {
    setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
  }

  function back() {
    setStep((current) => Math.max(current - 1, 0));
  }

  const canContinue = interests.length >= 1;
  const hint =
    interests.length === 0
      ? "Escolha ao menos um gosto para continuar."
      : interests.length < 3
        ? "Pode escolher mais — 3 ou mais afinam melhor o resultado."
        : "Bom perfil. Vamos ver os destinos.";

  return (
    <div className="flow">
      <ol className="flow-steps">
        {STEP_LABELS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              className={`flow-step ${i < step ? "done" : ""} ${i === step ? "active" : ""}`}
              aria-current={i === step ? "step" : undefined}
              disabled={i > step}
              onClick={() => goTo(i)}
            >
              <span className="fs-num">{i < step ? "✓" : i + 1}</span>
              <span className="fs-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="flow-progress">
        <i style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }} />
      </div>

      <div className="flow-stage" key={step}>
        {step === 0 ? (
          <StageOnboarding
            interests={interests}
            pace={pace}
            onToggle={toggleInterest}
            onPace={setPace}
          />
        ) : null}
        {step === 1 ? (
          <StageDiscovery
            results={results}
            pickIndex={pickIndex}
            gostos={gostos || "seu gosto"}
            onPick={(index) => {
              setPickIndex(index);
              next();
            }}
          />
        ) : null}
        {step === 2 && chosen ? (
          <StageItinerary
            city={chosen.dest.city}
            temp={`${chosen.dest.tempValue} ${chosen.dest.tempLabel}`}
            paceLabel={paceLabel}
            gostos={gostos || "praia e gastronomia"}
          />
        ) : null}
        {step === 3 && chosen ? (
          <StageFlights city={chosen.dest.city} cost={chosen.dest.cost} />
        ) : null}
      </div>

      <div className="flow-nav">
        {step > 0 ? (
          <button type="button" className="flow-back" onClick={back}>
            ← Voltar
          </button>
        ) : (
          <span />
        )}

        {step === 0 ? (
          <div className="flow-next-wrap">
            <button type="button" className="flow-next" disabled={!canContinue} onClick={next}>
              Continuar<span aria-hidden="true"> →</span>
            </button>
            <p className="flow-hint">{hint}</p>
          </div>
        ) : null}

        {step === 1 && chosen ? (
          <button type="button" className="flow-next" onClick={next}>
            Continuar com {chosen.dest.city}
            <span aria-hidden="true"> →</span>
          </button>
        ) : null}

        {step === 2 ? (
          <button type="button" className="flow-next" onClick={next}>
            Ver voo e hotel<span aria-hidden="true"> →</span>
          </button>
        ) : null}

        {step === 3 ? (
          <a className="flow-next" href="#lista">
            É assim no app — entrar na lista
          </a>
        ) : null}
      </div>
    </div>
  );
}
