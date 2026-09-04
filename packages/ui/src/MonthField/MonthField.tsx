import { useId, useState } from "react";
import "./MonthField.css";
import {
  MONTHS_SHORT,
  currentMonth,
  isPastMonth,
  monthLabel,
  parseMonthKey,
  toMonthKey
} from "../DateRangeField/calendar";

export type MonthFieldProps = {
  label: string;
  /** "YYYY-MM", ou "" enquanto ninguém escolheu. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Hoje. Existe para o teste fixar o relógio; em produção fica no padrão. */
  today?: Date;
};

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}


/** Irmão do DateRangeField para o modo "mês aproximado": o input[type=month]
 *  nativo mostra "--------- ----" vazio e não aceita estilo no seletor. */
export function MonthField({
  label,
  value,
  onChange,
  placeholder = "Escolha o mês",
  today = new Date()
}: MonthFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Nada de ano cravado no código: ele envelhece em silêncio e passa a abrir o
  // seletor num ano que já foi.
  const nowMonth = currentMonth(today);
  const [year, setYear] = useState(value === "" ? nowMonth.year : parseMonthKey(value).year);

  const chosen = value === "" ? null : parseMonthKey(value);

  return (
    <div
      className="farol-monthfield"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <span className="farol-monthfield__label" id={id}>
        {label}
      </span>
      <button
        type="button"
        className="farol-monthfield__control"
        aria-labelledby={id}
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="farol-monthfield__icon">
          <CalendarIcon />
        </span>
        <span
          className={
            chosen === null
              ? "farol-monthfield__value farol-monthfield__value--empty"
              : "farol-monthfield__value"
          }
        >
          {chosen === null ? placeholder : monthLabel(chosen)}
        </span>
      </button>

      {open ? (
        <div className="farol-monthfield__pop" role="dialog" aria-label={label}>
          <div className="farol-monthfield__head">
            <button
              type="button"
              className="farol-monthfield__nav"
              aria-label="Ano anterior"
              disabled={year <= nowMonth.year}
              onClick={() => setYear((y) => y - 1)}
            >
              <Chevron dir="left" />
            </button>
            <span className="farol-monthfield__year" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              className="farol-monthfield__nav"
              aria-label="Próximo ano"
              onClick={() => setYear((y) => y + 1)}
            >
              <Chevron dir="right" />
            </button>
          </div>

          <div className="farol-monthfield__grid">
            {MONTHS_SHORT.map((name, index) => {
              const month = index + 1;
              const on = chosen !== null && chosen.year === year && chosen.month === month;
              // Mês que já passou não vira viagem: voo e hotel voltam vazios e
              // a tela não tem como explicar o porquê.
              const past = isPastMonth({ year, month }, nowMonth);
              return (
                <button
                  type="button"
                  key={name}
                  className={
                    on ? "farol-monthfield__month farol-monthfield__month--on" : "farol-monthfield__month"
                  }
                  aria-pressed={on}
                  disabled={past}
                  onClick={() => {
                    onChange(toMonthKey({ year, month }));
                    setOpen(false);
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
