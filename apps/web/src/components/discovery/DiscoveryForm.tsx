"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, DateRangeField, Slider, Stepper, TextField } from "@farol/ui";
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
import { SegmentedControl } from "../onboarding/SegmentedControl";
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
  pending = false
}: {
  onSubmit: (input: TripInput) => void;
  pending?: boolean;
}) {
  const [state, setState] = useState<DiscoveryFormState>(EMPTY_DISCOVERY_FORM);
  const patch = (next: Partial<DiscoveryFormState>) => setState((s) => ({ ...s, ...next }));

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
        <div className="screen__label">De onde você sai</div>
        <OriginField value={state.originIata} onChange={(originIata) => patch({ originIata })} />
      </div>

      <SegmentedControl
        label="Quando"
        options={MODE_OPTIONS}
        value={state.mode}
        onChange={(mode) => patch({ mode: mode as DiscoveryFormState["mode"] })}
      />

      <div className="screen__row df-grid">
        {state.mode === "exact" ? (
          <DateRangeField
            label="Datas"
            start={state.dateStart}
            end={state.dateEnd}
            onChange={({ start, end }) => patch({ dateStart: start, dateEnd: end })}
          />
        ) : (
          <>
            <TextField
              label="Mês"
              type="month"
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
          label="Orçamento total"
          value={state.budgetTotal}
          min={BUDGET_MIN}
          max={BUDGET_MAX}
          step={BUDGET_STEP}
          onChange={(budgetTotal) => patch({ budgetTotal })}
          formatValue={brl}
        />
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
