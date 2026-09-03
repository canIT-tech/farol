"use client";

import { useEffect, useRef, useState } from "react";
import { TextField } from "@farol/ui";
import "./OriginField.css";
import type { Airport } from "@farol/shared";
import { searchAirports, whereami } from "../../lib/geo-api";

const MIN_TERM = 2;
const HINT_DEFAULT = "Código IATA, cidade ou nome do aeroporto";

/** "São Paulo — Guarulhos (GRU)" quando há cidade; senão só o aeroporto. */
export function airportLabel(airport: Airport): string {
  return `${airport.name} (${airport.iata})`;
}

export function OriginField({
  value,
  onChange,
  detectOrigin = whereami,
  findAirports = searchAirports
}: {
  value: string;
  onChange: (iata: string) => void;
  detectOrigin?: typeof whereami;
  findAirports?: typeof searchAirports;
}) {
  const [term, setTerm] = useState(value);
  const [options, setOptions] = useState<Airport[]>([]);
  const [chosen, setChosen] = useState<Airport | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // A detecção roda uma vez, no mount: é palpite inicial, não reage a
  // digitação. Os refs deixam o efeito ler o valor atual sem virar dependência.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  // Sugestão de origem pelo IP. Só preenche campo vazio — o que a pessoa
  // digitou vale mais que o palpite —, e falhar aqui não muda nada na tela.
  useEffect(() => {
    let active = true;
    detectOrigin()
      .then((place) => {
        if (active && place !== null) {
          setSuggested(`${place.name} (${place.iata})`);
          setTerm((current) => (current === "" ? place.iata : current));
          const current = valueRef.current;
          onChangeRef.current(current === "" ? place.iata : current);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [detectOrigin]);

  // Busca no catálogo a cada tecla. Termo curto não busca: o dump inteiro
  // casaria com quase tudo e a lista viraria ruído.
  useEffect(() => {
    if (chosen !== null || term.trim().length < MIN_TERM) {
      setOptions([]);
      return;
    }
    let active = true;
    findAirports(term)
      .then((found) => {
        if (active) {
          setOptions(found);
        }
      })
      .catch(() => {
        if (active) {
          setOptions([]);
        }
      });
    return () => {
      active = false;
    };
  }, [term, chosen, findAirports]);

  function type(next: string) {
    setTerm(next);
    setChosen(null);
    onChange(next.length === 3 ? next.toUpperCase() : "");
  }

  function pick(airport: Airport) {
    setChosen(airport);
    setTerm(airport.iata);
    setOptions([]);
    onChange(airport.iata);
  }

  const hint =
    chosen !== null
      ? airportLabel(chosen)
      : suggested === null
        ? HINT_DEFAULT
        : `Sugeri ${suggested} pela sua conexão. Troque se não for daí.`;

  return (
    <div
      className="origin"
      // O foco entra e sai por dentro do container (campo → opção), então o
      // blur só fecha quando vai para fora dele.
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      }}
    >
      <TextField label="Saindo de" value={term} onChange={type} placeholder="GRU" hint={hint} />
      {focused && options.length > 0 ? (
        <ul className="origin__list" role="listbox" aria-label="Aeroportos encontrados">
          {options.map((airport) => (
            <li key={airport.iata}>
              <button
                className="origin__option"
                type="button"
                onClick={() => pick(airport)}
                aria-label={airportLabel(airport)}
              >
                <span className="origin__iata">{airport.iata}</span>
                <span className="origin__name">{airport.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
