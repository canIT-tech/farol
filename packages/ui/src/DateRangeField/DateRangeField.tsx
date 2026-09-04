import { useId, useState } from "react";
import "./DateRangeField.css";
import {
  WEEKDAYS,
  addMonths,
  currentMonth,
  formatRange,
  isBefore,
  isInside,
  isPastMonth,
  monthLabel,
  monthMatrix,
  monthOf,
  nextRange,
  parseIso,
  todayIso,
  type YearMonth
} from "./calendar";

export type DateRangeFieldProps = {
  label: string;
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
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

export function DateRangeField({
  label,
  start,
  end,
  onChange,
  placeholder = "Escolha as datas",
  today = new Date()
}: DateRangeFieldProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Sem mês cravado no código: o anterior era `{ year: 2026, month: 1 }` com o
  // nome de TODAY, e abria o calendário oito meses no passado.
  const nowMonth = currentMonth(today);
  const nowIso = todayIso(today);
  const [month, setMonth] = useState<YearMonth>(start === "" ? nowMonth : monthOf(start));

  const weeks = monthMatrix(month);
  const shown = formatRange(start, end);

  function pick(iso: string) {
    const range = nextRange({ start, end }, iso);
    onChange(range);
    // O intervalo fechado é o fim da tarefa; o aberto espera a volta.
    if (range.end !== "") {
      setOpen(false);
    }
  }

  return (
    <div
      className="farol-daterange"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <span className="farol-daterange__label" id={id}>
        {label}
      </span>
      <button
        type="button"
        className="farol-daterange__control"
        aria-labelledby={id}
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="farol-daterange__icon">
          <CalendarIcon />
        </span>
        <span
          className={
            shown === ""
              ? "farol-daterange__value farol-daterange__value--empty"
              : "farol-daterange__value"
          }
        >
          {shown === "" ? placeholder : shown}
        </span>
      </button>

      {open ? (
        <div className="farol-daterange__pop" role="dialog" aria-label={label}>
          <div className="farol-daterange__head">
            <button
              type="button"
              className="farol-daterange__nav"
              aria-label="Mês anterior"
              disabled={isPastMonth(addMonths(month, -1), nowMonth)}
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <Chevron dir="left" />
            </button>
            <span className="farol-daterange__month" aria-live="polite">
              {monthLabel(month)}
            </span>
            <button
              type="button"
              className="farol-daterange__nav"
              aria-label="Próximo mês"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <Chevron dir="right" />
            </button>
          </div>

          <div className="farol-daterange__weekdays" aria-hidden="true">
            {WEEKDAYS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>

          <div className="farol-daterange__grid" role="grid">
            {weeks.map((week, wi) => (
              <div className="farol-daterange__week" role="row" key={wi}>
                {week.map((iso, di) =>
                  iso === null ? (
                    <span className="farol-daterange__gap" key={di} />
                  ) : (
                    <button
                      type="button"
                      key={di}
                      role="gridcell"
                      className={[
                        "farol-daterange__day",
                        iso === start && "farol-daterange__day--start",
                        iso === end && "farol-daterange__day--end",
                        isInside(iso, start, end) && "farol-daterange__day--inside"
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-pressed={iso === start || iso === end}
                      // Dia que já passou não vira viagem: voo e hotel voltam
                      // vazios e a tela não tem como explicar o porquê.
                      disabled={isBefore(iso, nowIso)}
                      onClick={() => pick(iso)}
                    >
                      {parseIso(iso).day}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
