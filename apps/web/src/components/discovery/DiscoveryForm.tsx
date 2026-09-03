"use client";

import { useEffect, useState } from "react";
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
import { whereami } from "../../lib/geo-api";

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
  pending = false,
  detectOrigin = whereami
}: {
  onSubmit: (input: TripInput) => void;
  pending?: boolean;
  detectOrigin?: typeof whereami;
}) {
  const [state, setState] = useState<DiscoveryFormState>(EMPTY_DISCOVERY_FORM);
  const [suggestedOrigin, setSuggestedOrigin] = useState<string | null>(null);
  const patch = (next: Partial<DiscoveryFormState>) => setState((s) => ({ ...s, ...next }));

  // Sugestão de origem pelo IP. Só preenche campo vazio — o que a pessoa
  // digitou vale mais que o palpite —, e falhar aqui não muda nada na tela.
  useEffect(() => {
    let active = true;
    detectOrigin()
      .then((place) => {
        if (active && place !== null) {
          setSuggestedOrigin(`${place.name} (${place.iata})`);
          setState((s) => (s.originIata === "" ? { ...s, originIata: place.iata } : s));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [detectOrigin]);

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
      <TextField
        label="Saindo de"
        value={state.originIata}
        onChange={(originIata) => patch({ originIata })}
        placeholder="GRU"
        maxLength={3}
        hint={
          suggestedOrigin === null
            ? "Código IATA do aeroporto de origem"
            : `Sugeri ${suggestedOrigin} pela sua conexão. Troque se não for daí.`
        }
      />

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
