"use client";

import { useMemo, useState } from "react";
import { TASTES, rankDestinations } from "./destinations";

export default function TasteDemo() {
  const [selected, setSelected] = useState<string[]>(["praia", "gastronomia"]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  const ranked = useMemo(() => rankDestinations(selected), [selected]);
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
            : `${selected.length} ${selected.length === 1 ? "gosto" : "gostos"} — o Farol cruza isso com clima, custo e época de cada lugar.`}
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
                  {alternatives.map((alt) => `${alt.dest.city} (${alt.score}%)`).join(" · ")}
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
