"use client";

import { useState } from "react";

type Plan = {
  city: string;
  country: string;
  match: string;
  lines: string[];
  cost: string;
  photo: string;
};

type Turn = { role: "user" | "farol"; text: string };

type Prompt = {
  id: string;
  label: string;
  reply: string;
  next: (plan: Plan) => Plan;
};

const INITIAL: Plan = {
  city: "Cartagena",
  country: "Colômbia",
  match: "94% de aderência",
  lines: [
    "Dia 1 · Cidade Amuralhada a pé + almoço na Cevichería",
    "Dia 4 · Manhã no Museu do Ouro Zenú",
    "Dia 6 · Jantar em Getsemaní e caminhada"
  ],
  cost: "R$ 4.100 / pessoa",
  photo: "linear-gradient(150deg,#e8caa6,#c98a63 55%,#a9683f)"
};

const PROMPTS: Prompt[] = [
  {
    id: "praia",
    label: "Menos museu, mais praia",
    reply:
      "Feito. O Dia 4 virou praia com passeio de barco às Ilhas do Rosário — o custo do dia caiu R$ 120.",
    next: (plan) => ({
      ...plan,
      lines: plan.lines.map((line) =>
        line.startsWith("Dia 4")
          ? "Dia 4 · Passeio de barco às Ilhas do Rosário"
          : line
      ),
      cost: "R$ 3.980 / pessoa"
    })
  },
  {
    id: "barato",
    label: "Tem voo mais barato saindo sábado?",
    reply:
      "Sábado 10/mai tem direto por R$ 1.890/pessoa, R$ 250 abaixo. Já adiantei a chegada do Dia 1.",
    next: (plan) => ({ ...plan, cost: "R$ 3.850 / pessoa" })
  },
  {
    id: "troca",
    label: "Troca por um lugar mais tranquilo",
    reply:
      "Troquei Cartagena por Porto: mesma gastronomia e vinho, metade da agitação. 82% de aderência.",
    next: () => ({
      city: "Porto",
      country: "Portugal",
      match: "82% de aderência",
      lines: [
        "Dia 1 · Ribeira e prova de vinho do Porto",
        "Dia 3 · Livraria Lello e mercado do Bolhão",
        "Dia 5 · Bate-volta a Guimarães"
      ],
      cost: "R$ 5.200 / pessoa",
      photo: "linear-gradient(150deg,#c8d2d6,#93a9b1 55%,#6f8b95)"
    })
  }
];

export default function ChatDemo() {
  const [plan, setPlan] = useState<Plan>(INITIAL);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "farol",
      text: "Montei 7 dias em Cartagena com foco em praia e gastronomia. Deixei o Dia 1 mais leve para você se adaptar ao calor."
    }
  ]);
  const [used, setUsed] = useState<string[]>([]);

  function run(prompt: Prompt) {
    setTurns((current) => [
      ...current,
      { role: "user", text: prompt.label },
      { role: "farol", text: prompt.reply }
    ]);
    setPlan((current) => prompt.next(current));
    setUsed((current) => [...current, prompt.id]);
  }

  function reset() {
    setPlan(INITIAL);
    setTurns([
      {
        role: "farol",
        text: "Montei 7 dias em Cartagena com foco em praia e gastronomia. Deixei o Dia 1 mais leve para você se adaptar ao calor."
      }
    ]);
    setUsed([]);
  }

  const allUsed = used.length === PROMPTS.length;

  return (
    <div className="chat-grid">
      <div className="cd">
        <div className="cd-head">Assessor · exemplo</div>
        <div className="cd-thread">
          {turns.map((turn, i) => (
            <span key={`${turn.role}-${i}`} className={`cd-bub ${turn.role === "user" ? "u" : "a"}`}>
              {turn.text}
            </span>
          ))}
        </div>
        <div className="cd-prompts">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              disabled={used.includes(prompt.id)}
              onClick={() => run(prompt)}
            >
              {prompt.label}
            </button>
          ))}
        </div>
        {used.length > 0 ? (
          <button type="button" className="cd-reset" onClick={reset}>
            {allUsed ? "Recomeçar o exemplo" : "Voltar ao plano inicial"}
          </button>
        ) : null}
      </div>

      <article className="cd-plan" aria-live="polite">
        <div className="ph" style={{ background: plan.photo }} />
        <div className="pb">
          <div className="city">
            {plan.city}
            <span style={{ color: "var(--ink-faint)", fontWeight: 400, fontSize: "0.9rem" }}>
              {" "}
              · {plan.country}
            </span>
          </div>
          <span className="match">{plan.match}</span>
          <ul>
            {plan.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="cost">
            Gasto estimado <b>{plan.cost}</b>
          </p>
        </div>
      </article>
    </div>
  );
}
