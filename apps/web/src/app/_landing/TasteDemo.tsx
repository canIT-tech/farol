"use client";

import { useMemo, useState } from "react";

type Destination = {
  city: string;
  country: string;
  tags: string[];
  why: string;
  temp: string;
  flight: string;
  cost: string;
  photo: string;
};

const TASTES: Array<{ id: string; label: string }> = [
  { id: "praia", label: "Praia" },
  { id: "gastronomia", label: "Gastronomia" },
  { id: "cultura", label: "Cultura" },
  { id: "natureza", label: "Natureza" },
  { id: "noturna", label: "Vida noturna" },
  { id: "sossego", label: "Sossego" },
  { id: "aventura", label: "Aventura" },
  { id: "compras", label: "Compras" }
];

const DESTINATIONS: Destination[] = [
  {
    city: "Cartagena",
    country: "Colômbia",
    tags: ["praia", "gastronomia", "cultura", "noturna"],
    why: "Praia e um centro histórico que já é, ele mesmo, um roteiro gastronômico. Maio é época seca.",
    temp: "31° seco",
    flight: "5h direto",
    cost: "R$ 4,1k / pessoa",
    photo: "linear-gradient(155deg,#e8caa6,#c98a63 55%,#a9683f)"
  },
  {
    city: "Lisboa",
    country: "Portugal",
    tags: ["cultura", "gastronomia", "sossego", "praia"],
    why: "Clima ameno, ladeiras históricas e praia a 30 minutos quando bater vontade.",
    temp: "21° ameno",
    flight: "9h30 direto",
    cost: "R$ 5,6k / pessoa",
    photo: "linear-gradient(155deg,#e6bcac,#c08f92 60%,#9a6f78)"
  },
  {
    city: "Cidade do México",
    country: "México",
    tags: ["gastronomia", "cultura", "noturna", "compras"],
    why: "Para comer bem a semana inteira, andar por bairros e gastar pouco em diária.",
    temp: "24° ameno",
    flight: "9h · 1 escala",
    cost: "R$ 4,3k / pessoa",
    photo: "linear-gradient(155deg,#d8c9a8,#b39a6d 55%,#8f7a4c)"
  },
  {
    city: "Maceió",
    country: "Brasil · Alagoas",
    tags: ["praia", "sossego"],
    why: "Água calma, pouco deslocamento e a opção mais econômica da seleção.",
    temp: "29° sol",
    flight: "2h30 direto",
    cost: "R$ 2,2k / pessoa",
    photo: "linear-gradient(155deg,#bdd8ce,#8fbcae 55%,#659c92)"
  },
  {
    city: "Chapada dos Veadeiros",
    country: "Brasil · Goiás",
    tags: ["natureza", "aventura", "sossego"],
    why: "Cachoeiras, trilhas e céu limpo à noite. Ritmo lento por escolha, não por falta de opção.",
    temp: "26° seco",
    flight: "3h + estrada",
    cost: "R$ 2,6k / pessoa",
    photo: "linear-gradient(155deg,#cfe0c2,#9cbf86 55%,#6f9c5e)"
  },
  {
    city: "Cidade do Cabo",
    country: "África do Sul",
    tags: ["natureza", "aventura", "gastronomia", "praia"],
    why: "Montanha, vinhedos e oceano no mesmo dia. Câmbio a favor do real.",
    temp: "22° ameno",
    flight: "13h · 1 escala",
    cost: "R$ 7,9k / pessoa",
    photo: "linear-gradient(155deg,#c2ccd0,#91a7af 55%,#6f8b95)"
  },
  {
    city: "Buenos Aires",
    country: "Argentina",
    tags: ["gastronomia", "cultura", "noturna", "compras"],
    why: "Jantar às 22h, livrarias enormes e feiras de bairro no fim de semana.",
    temp: "18° ameno",
    flight: "3h direto",
    cost: "R$ 3,4k / pessoa",
    photo: "linear-gradient(155deg,#e0c4b8,#bd928a 55%,#946a67)"
  },
  {
    city: "Tóquio",
    country: "Japão",
    tags: ["cultura", "gastronomia", "noturna", "compras", "aventura"],
    why: "Densidade, precisão e comida boa em qualquer esquina. Cansa e vale a pena.",
    temp: "16° fresco",
    flight: "24h · 1 escala",
    cost: "R$ 9,2k / pessoa",
    photo: "linear-gradient(155deg,#d5c2d0,#a68fae 55%,#7c6c92)"
  }
];

function scoreFor(dest: Destination, selected: string[]): number {
  if (selected.length === 0) return 0;
  const hits = selected.filter((t) => dest.tags.includes(t)).length;
  if (hits === 0) return 0;
  const coverage = hits / selected.length;
  const raw = coverage * 0.82 + 0.12 + Math.min(dest.tags.length, 6) * 0.006;
  return Math.round(Math.min(0.97, raw) * 100);
}

export default function TasteDemo() {
  const [selected, setSelected] = useState<string[]>(["praia", "gastronomia"]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  const ranked = useMemo(() => {
    return DESTINATIONS.map((dest) => ({ dest, score: scoreFor(dest, selected) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.dest.tags.length - b.dest.tags.length);
  }, [selected]);

  const best = ranked[0];
  const runnerUp = ranked[1];

  return (
    <div className="demo-grid">
      <div>
        <div className="chips">
          {TASTES.map((taste) => {
            const on = selected.includes(taste.id);
            return (
              <button
                key={taste.id}
                type="button"
                className="chip-btn"
                aria-pressed={on}
                onClick={() => toggle(taste.id)}
              >
                {taste.label}
              </button>
            );
          })}
        </div>
        <p className="demo-hint">
          {selected.length === 0
            ? "Escolha ao menos um gosto para ver um destino."
            : `${selected.length} ${selected.length === 1 ? "gosto" : "gostos"} — o Farol cruza isso com clima, custo e época.`}
        </p>
      </div>

      <div className="result-wrap" aria-live="polite">
        {best ? (
          <article className="result fade-key" key={best.dest.city}>
            <div className="photo" style={{ background: best.dest.photo }}>
              <span className="match">{best.score}% de aderência</span>
            </div>
            <div className="body">
              <div className="city">{best.dest.city}</div>
              <div className="country">{best.dest.country}</div>
              <div className="bar">
                <i style={{ width: `${best.score}%` }} />
              </div>
              <p className="why">{best.dest.why}</p>
              <div className="stats">
                <span>
                  <b>{best.dest.temp.split(" ")[0]}</b> {best.dest.temp.split(" ").slice(1).join(" ")}
                </span>
                <span>
                  <b>{best.dest.flight.split(" ")[0]}</b>{" "}
                  {best.dest.flight.split(" ").slice(1).join(" ")}
                </span>
                <span>
                  <b>{best.dest.cost.split(" ")[0]}</b> total
                </span>
              </div>
              {runnerUp ? (
                <p className="runnerup">
                  Também bate: {runnerUp.dest.city} ({runnerUp.score}%)
                </p>
              ) : null}
            </div>
          </article>
        ) : (
          <article className="result empty">
            <div className="body">Escolha um gosto acima e o destino aparece aqui.</div>
          </article>
        )}
      </div>
    </div>
  );
}
