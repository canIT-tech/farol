"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Slider, Stepper, TextField } from "@farol/ui";
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
      <OriginField value={state.originIata} onChange={(originIata) => patch({ originIata })} />

      <SegmentedControl
        label="Quando"
        options={MODE_OPTIONS}
        value={state.mode}
        onChange={(mode) => patch({ mode: mode as DiscoveryFormState["mode"] })}
      />

      {state.mode === "exact" ? (
        <>
          <TextField
            label="Ida"
            type="date"
            value={state.dateStart}
            onChange={(dateStart) => patch({ dateStart })}
          />
          <TextField
            label="Volta"
            type="date"
            value={state.dateEnd}
            onChange={(dateEnd) => patch({ dateEnd })}
          />
        </>
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

      <Slider
        label="Orçamento total"
        value={state.budgetTotal}
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={BUDGET_STEP}
        onChange={(budgetTotal) => patch({ budgetTotal })}
        formatValue={brl}
      />

      <p>
        O roteiro usa o seu perfil de gosto. <Link href="/onboarding">Ajustar gostos</Link>
      </p>

      <Button type="submit" disabled={!canSubmitDiscovery(state) || pending} loading={pending}>
        Buscar destinos
      </Button>
    </form>
  );
}
