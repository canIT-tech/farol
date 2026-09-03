"use client";

import { useState } from "react";
import { Button, Chip, Slider, TextField } from "@farol/ui";
import { OriginField } from "../discovery/OriginField";
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP
} from "../../lib/discovery-form";
import { INTEREST_OPTIONS } from "../../lib/onboarding";
import {
  EMPTY_AUTO_FORM,
  MAX_AUTO_INTERESTS,
  canSubmitAuto,
  toggleAutoInterest,
  type AutoFormState
} from "../../lib/auto-plan";

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  });
}

export function AutoForm({
  onSubmit,
  pending = false
}: {
  onSubmit: (state: AutoFormState) => void;
  pending?: boolean;
}) {
  const [state, setState] = useState<AutoFormState>(EMPTY_AUTO_FORM);
  const patch = (next: Partial<AutoFormState>) => setState((s) => ({ ...s, ...next }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmitAuto(state)) {
          onSubmit(state);
        }
      }}
    >
      <OriginField value={state.originIata} onChange={(originIata) => patch({ originIata })} />
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
      <Slider
        label="Orçamento total"
        value={state.budgetTotal}
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={BUDGET_STEP}
        onChange={(budgetTotal) => patch({ budgetTotal })}
        formatValue={brl}
      />

      <fieldset>
        <legend>{`Escolha ${MAX_AUTO_INTERESTS} gostos`}</legend>
        <div role="group" aria-label="Gostos">
          {INTEREST_OPTIONS.map((interest) => (
            <Chip
              key={interest}
              tone="taste"
              selected={state.interests.includes(interest)}
              onClick={() => patch({ interests: toggleAutoInterest(state.interests, interest) })}
            >
              {interest}
            </Chip>
          ))}
        </div>
        <p aria-live="polite">{`${state.interests.length} de ${MAX_AUTO_INTERESTS}`}</p>
      </fieldset>

      <Button type="submit" disabled={!canSubmitAuto(state) || pending} loading={pending}>
        Montar meu plano
      </Button>
    </form>
  );
}
