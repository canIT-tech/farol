"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, DateRangeField, MonthField, Slider, Stepper } from "@farol/ui";
import type { TripInput } from "@farol/shared";
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP,
  DURATION_MAX,
  DURATION_MIN,
  EMPTY_DISCOVERY_FORM,
  canSubmitDiscovery,
  toTripInput,
  type DiscoveryFormState
} from "../../lib/discovery-form";
import { OriginField } from "./OriginField";
import "./DiscoveryForm.css";

const MODE_OPTIONS = [
  { value: "month", label: "Mês aproximado" },
  { value: "exact", label: "Datas exatas" }
];

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  });
}

export function DiscoveryForm({
  onSubmit,
  onStateChange,
  adults = EMPTY_DISCOVERY_FORM.adults,
  pending = false
}: {
  onSubmit: (input: TripInput) => void;
  /** A sidebar espelha o que está sendo preenchido, como no hi-fi. */
  onStateChange?: (state: DiscoveryFormState) => void;
  /** Palpite inicial de adultos, vindo da companhia do perfil de gosto. */
  adults?: number;
  pending?: boolean;
}) {
  const [state, setState] = useState<DiscoveryFormState>({ ...EMPTY_DISCOVERY_FORM, adults });
  const patch = (next: Partial<DiscoveryFormState>) =>
    setState((s) => {
      const merged = { ...s, ...next };
      onStateChange?.(merged);
      return merged;
    });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const input = toTripInput(state);
        if (input !== null) {
          onSubmit(input);
        }
      }}
    >
      <div className="screen__row">
        <OriginField value={state.originIata} onChange={(originIata) => patch({ originIata })} />
      </div>

      <div className="screen__row">
        <div className="screen__label">Quando</div>
        <div className="df-grid">
          {state.mode === "exact" ? (
            <DateRangeField
              label="Datas"
              start={state.dateStart}
              end={state.dateEnd}
              onChange={({ start, end }) => patch({ dateStart: start, dateEnd: end })}
            />
          ) : (
            <>
              <MonthField
                label="Mês"
                value={state.targetMonth}
                onChange={(targetMonth) => patch({ targetMonth })}
              />
              <Stepper
                label="Dias de viagem"
                value={state.durationDays}
                min={DURATION_MIN}
                max={DURATION_MAX}
                onChange={(durationDays) => patch({ durationDays })}
              />
            </>
          )}
        </div>
        <div className="df-toggle">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={state.mode === option.value}
              className={
                state.mode === option.value ? "df-toggle__item df-toggle__item--on" : "df-toggle__item"
              }
              onClick={() => patch({ mode: option.value as DiscoveryFormState["mode"] })}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="screen__row df-grid">
        <Stepper
          label="Adultos"
          value={state.adults}
          min={1}
          max={9}
          onChange={(adults) => patch({ adults })}
        />
        <Stepper
          label="Crianças"
          value={state.children}
          min={0}
          max={9}
          onChange={(children) => patch({ children })}
        />
      </div>

      <div className="screen__row">
        <Slider
          label="Orçamento total (voo + hospedagem + gastos locais)"
          value={state.budgetTotal}
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          onChange={(budgetTotal) => patch({ budgetTotal })}
          formatValue={brl}
        />
        <div className="df-scale">
          <span>{brl(BUDGET_MIN)}</span>
          <span>{`${brl(BUDGET_MAX)}+`}</span>
        </div>
      </div>

      <p className="screen__hint">
        O roteiro usa o seu perfil de gosto. <Link href="/onboarding">Ajustar gostos</Link>
      </p>

      <Button
        type="submit"
        size="lg"
        className="df-cta"
        disabled={!canSubmitDiscovery(state) || pending}
        loading={pending}
      >
        Buscar destinos
      </Button>
    </form>
  );
}
