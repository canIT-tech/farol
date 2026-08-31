"use client";

import { useMemo, useState } from "react";

type Destination = {
  city: string;
  country: string;
  tags: string[];
  bias: number;
  why: string;
  tempValue: string;
  tempLabel: string;
  flightValue: string;
  flightLabel: string;
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

const WARM = "linear-gradient(155deg,#e8caa6,#c98a63 55%,#a9683f)";
const ROSE = "linear-gradient(155deg,#e6bcac,#c08f92 60%,#9a6f78)";
const SAND = "linear-gradient(155deg,#d8c9a8,#b39a6d 55%,#8f7a4c)";
const SEA = "linear-gradient(155deg,#bdd8ce,#8fbcae 55%,#659c92)";
const FERN = "linear-gradient(155deg,#cfe0c2,#9cbf86 55%,#6f9c5e)";
const SLATE = "linear-gradient(155deg,#c2ccd0,#91a7af 55%,#6f8b95)";
const PLUM = "linear-gradient(155deg,#d5c2d0,#a68fae 55%,#7c6c92)";
const CLAY = "linear-gradient(155deg,#e0c4b8,#bd928a 55%,#946a67)";

const DESTINATIONS: Destination[] = [
  {
    city: "Cartagena",
    country: "Colômbia",
    tags: ["praia", "gastronomia", "cultura", "noturna"],
    bias: 4,
    why: "Praia e um centro histórico que já é, ele mesmo, um roteiro gastronômico. Maio é época seca.",
    tempValue: "31°",
    tempLabel: "seco",
    flightValue: "5h",
    flightLabel: "direto",
    cost: "R$ 4,1k",
    photo: WARM
  },
  {
    city: "Lisboa",
    country: "Portugal",
    tags: ["cultura", "gastronomia", "sossego", "praia"],
    bias: 4,
    why: "Clima ameno, ladeiras históricas e praia a 30 minutos quando bater vontade.",
    tempValue: "21°",
    tempLabel: "ameno",
    flightValue: "9h30",
    flightLabel: "direto",
    cost: "R$ 5,6k",
    photo: ROSE
  },
  {
    city: "Cidade do México",
    country: "México",
    tags: ["gastronomia", "cultura", "noturna", "compras"],
    bias: 3,
    why: "Para comer bem a semana inteira, andar por bairros e gastar pouco em diária.",
    tempValue: "24°",
    tempLabel: "ameno",
    flightValue: "9h",
    flightLabel: "1 escala",
    cost: "R$ 4,3k",
    photo: SAND
  },
  {
    city: "Maceió",
    country: "Brasil · Alagoas",
    tags: ["praia", "sossego"],
    bias: 3,
    why: "Água calma, pouco deslocamento e a opção mais econômica da seleção.",
    tempValue: "29°",
    tempLabel: "sol",
    flightValue: "2h30",
    flightLabel: "direto",
    cost: "R$ 2,2k",
    photo: SEA
  },
  {
    city: "Chapada dos Veadeiros",
    country: "Brasil · Goiás",
    tags: ["natureza", "aventura", "sossego"],
    bias: 5,
    why: "Cachoeiras, trilhas e céu limpo à noite. Ritmo lento por escolha, não por falta de opção.",
    tempValue: "26°",
    tempLabel: "seco",
    flightValue: "3h",
    flightLabel: "+ estrada",
    cost: "R$ 2,6k",
    photo: FERN
  },
  {
    city: "Cidade do Cabo",
    country: "África do Sul",
    tags: ["natureza", "aventura", "gastronomia", "praia"],
    bias: 4,
    why: "Montanha, vinhedos e oceano no mesmo dia. Câmbio a favor do real.",
    tempValue: "22°",
    tempLabel: "ameno",
    flightValue: "13h",
    flightLabel: "1 escala",
    cost: "R$ 7,9k",
    photo: SLATE
  },
  {
    city: "Buenos Aires",
    country: "Argentina",
    tags: ["gastronomia", "cultura", "noturna", "compras"],
    bias: 4,
    why: "Jantar às 22h, livrarias enormes e feiras de bairro no fim de semana.",
    tempValue: "18°",
    tempLabel: "ameno",
    flightValue: "3h",
    flightLabel: "direto",
    cost: "R$ 3,4k",
    photo: CLAY
  },
  {
    city: "Tóquio",
    country: "Japão",
    tags: ["cultura", "gastronomia", "noturna", "compras", "aventura"],
    bias: 3,
    why: "Densidade, precisão e comida boa em qualquer esquina. Cansa e vale a pena.",
    tempValue: "16°",
    tempLabel: "fresco",
    flightValue: "24h",
    flightLabel: "1 escala",
    cost: "R$ 9,2k",
    photo: PLUM
  },
  {
    city: "Jericoacoara",
    country: "Brasil · Ceará",
    tags: ["praia", "natureza", "sossego"],
    bias: 5,
    why: "Dunas, lagoas de água doce e vento. Sem carro, sem pressa, pôr do sol coletivo.",
    tempValue: "30°",
    tempLabel: "sol",
    flightValue: "4h",
    flightLabel: "+ transfer",
    cost: "R$ 3,1k",
    photo: SEA
  },
  {
    city: "Bariloche",
    country: "Argentina",
    tags: ["natureza", "aventura", "gastronomia"],
    bias: 3,
    why: "Lagos, trilhas e chocolate. Frio de verdade entre junho e agosto.",
    tempValue: "8°",
    tempLabel: "frio",
    flightValue: "4h30",
    flightLabel: "1 escala",
    cost: "R$ 4,0k",
    photo: SLATE
  },
  {
    city: "Roma",
    country: "Itália",
    tags: ["cultura", "gastronomia", "compras"],
    bias: 5,
    why: "Dois mil anos de camadas e a melhor cozinha simples da Europa. Ande com sapato bom.",
    tempValue: "19°",
    tempLabel: "ameno",
    flightValue: "12h",
    flightLabel: "direto",
    cost: "R$ 6,8k",
    photo: WARM
  },
  {
    city: "Medellín",
    country: "Colômbia",
    tags: ["noturna", "gastronomia", "natureza", "aventura"],
    bias: 4,
    why: "Primavera o ano todo, bairros em ascensão e teleférico como transporte público.",
    tempValue: "23°",
    tempLabel: "ameno",
    flightValue: "7h",
    flightLabel: "1 escala",
    cost: "R$ 3,6k",
    photo: FERN
  },
  {
    city: "Nova York",
    country: "Estados Unidos",
    tags: ["cultura", "compras", "gastronomia", "noturna"],
    bias: 4,
    why: "Museus de peso, comida do mundo inteiro e nenhuma noite igual à anterior.",
    tempValue: "14°",
    tempLabel: "frio",
    flightValue: "10h",
    flightLabel: "direto",
    cost: "R$ 7,4k",
    photo: PLUM
  },
  {
    city: "Paraty",
    country: "Brasil · Rio de Janeiro",
    tags: ["cultura", "natureza", "sossego", "praia"],
    bias: 4,
    why: "Centro colonial fechado para carros, cachoeiras na serra e um mar de ilhas logo ali.",
    tempValue: "27°",
    tempLabel: "úmido",
    flightValue: "5h",
    flightLabel: "+ estrada",
    cost: "R$ 2,4k",
    photo: SEA
  },
  {
    city: "Lima",
    country: "Peru",
    tags: ["gastronomia", "cultura"],
    bias: 5,
    why: "Uma das grandes capitais da gastronomia, à beira de um oceano cinza e bonito.",
    tempValue: "20°",
    tempLabel: "nublado",
    flightValue: "5h",
    flightLabel: "direto",
    cost: "R$ 3,8k",
    photo: CLAY
  },
  {
    city: "Cusco e Vale Sagrado",
    country: "Peru",
    tags: ["aventura", "natureza", "cultura"],
    bias: 5,
    why: "Altitude, ruínas incas e a trilha até Machu Picchu. Reserve 2 dias para aclimatar.",
    tempValue: "17°",
    tempLabel: "seco",
    flightValue: "7h",
    flightLabel: "1 escala",
    cost: "R$ 4,6k",
    photo: FERN
  },
  {
    city: "Ilha Grande",
    country: "Brasil · Rio de Janeiro",
    tags: ["natureza", "praia", "sossego", "aventura"],
    bias: 3,
    why: "Sem carros, trilhas para praias desertas e um mar transparente do lado sul.",
    tempValue: "28°",
    tempLabel: "úmido",
    flightValue: "5h",
    flightLabel: "+ barco",
    cost: "R$ 2,3k",
    photo: SEA
  },
  {
    city: "Berlim",
    country: "Alemanha",
    tags: ["noturna", "cultura", "compras"],
    bias: 5,
    why: "História pesada de dia, música eletrônica até de manhã. Barata para os padrões europeus.",
    tempValue: "12°",
    tempLabel: "frio",
    flightValue: "12h",
    flightLabel: "1 escala",
    cost: "R$ 6,2k",
    photo: SLATE
  }
];

function scoreFor(dest: Destination, selected: string[]): number {
  if (selected.length === 0) return 0;
  const hits = selected.filter((t) => dest.tags.includes(t)).length;
  if (hits === 0) return 0;
  const coverage = hits / selected.length;
  const depth = Math.min(hits, 4) / 4;
  const raw = coverage * 62 + depth * 24 + dest.bias + 8;
  return Math.round(Math.max(41, Math.min(97, raw)));
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
      .sort((a, b) => b.score - a.score || b.dest.bias - a.dest.bias);
  }, [selected]);

  const best = ranked[0];
  const alternatives = ranked.slice(1, 3);

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
            : `${selected.length} ${selected.length === 1 ? "gosto" : "gostos"} — o Farol cruza isso com ${DESTINATIONS.length} destinos, clima, custo e época.`}
        </p>
      </div>

      <div aria-live="polite">
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
                  <b>{best.dest.tempValue}</b> {best.dest.tempLabel}
                </span>
                <span>
                  <b>{best.dest.flightValue}</b> {best.dest.flightLabel}
                </span>
                <span>
                  <b>{best.dest.cost}</b> total
                </span>
              </div>
              {alternatives.length > 0 ? (
                <p className="runnerup">
                  Também batem:{" "}
                  {alternatives
                    .map((alt) => `${alt.dest.city} (${alt.score}%)`)
                    .join(" · ")}
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
