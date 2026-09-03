"use client";

import { useState } from "react";
import { Button, Chip, DateRangeField, Slider } from "@farol/ui";
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

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
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
      <div className="screen__row">
        <div className="screen__label">Quando &amp; de onde</div>
        <div className="auto-two">
          <DateRangeField
            label="Quando"
            start={state.dateStart}
            end={state.dateEnd}
            onChange={({ start, end }) => patch({ dateStart: start, dateEnd: end })}
          />
          <OriginField value={state.originIata} onChange={(originIata) => patch({ originIata })} />
        </div>
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
        <div className="auto-scale">
          <span>{brl(BUDGET_MIN)}</span>
          <span>{`${brl(BUDGET_MAX)}+`}</span>
        </div>
      </div>

      <fieldset className="screen__row">
        <legend className="screen__label">
          O que você curte <span>— até {MAX_AUTO_INTERESTS}</span>
        </legend>
        <div className="auto-chips" role="group" aria-label="Gostos">
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
        <p className="screen__hint" aria-live="polite">
          {`${state.interests.length} de ${MAX_AUTO_INTERESTS} — é só um empurrão inicial. O plano se ajusta depois conforme você reage a ele.`}
        </p>
      </fieldset>

      <Button
        type="submit"
        size="lg"
        className="auto-cta"
        iconEnd={<ArrowRight />}
        disabled={!canSubmitAuto(state) || pending}
        loading={pending}
      >
        Montar minha viagem
      </Button>
    </form>
  );
}
