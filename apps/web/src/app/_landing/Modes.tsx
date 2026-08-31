"use client";

import { useState } from "react";

type Mode = "assessor" | "autonomo";

const CONTENT: Record<Mode, Array<{ h: string; p: string }>> = {
  assessor: [
    {
      h: "Você escolhe entre opções",
      p: "O Farol traz uma lista curta de destinos e de voos, cada um com o porquê. A decisão é sua."
    },
    {
      h: "Ajuste fino no chat",
      p: "“Troca o hotel por um mais central”, “adianta o jantar de hoje”. O plano se refaz sem recomeçar."
    }
  ],
  autonomo: [
    {
      h: "Entrada mínima",
      p: "Datas, origem, orçamento e até 3 gostos. Nada de telas de comparação."
    },
    {
      h: "Um plano fechado",
      p: "O Farol decide o destino, monta o roteiro e explica a escolha. Mudou de ideia? Só pelo chat."
    }
  ]
};

export default function Modes() {
  const [mode, setMode] = useState<Mode>("assessor");

  return (
    <div>
      <div className="mode-toggle" role="tablist" aria-label="Modos do Farol">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "assessor"}
          onClick={() => setMode("assessor")}
        >
          Modo assessor
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "autonomo"}
          onClick={() => setMode("autonomo")}
        >
          Modo autônomo
        </button>
      </div>

      <div className="mode-panel" key={mode} role="tabpanel">
        {CONTENT[mode].map((item) => (
          <div className="cardlet" key={item.h}>
            <h4>{item.h}</h4>
            <p>{item.p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
