"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { paceEnum, partyEnum, tasteProfileSchema, type TasteProfileInput } from "@farol/shared";
import { AuthGate } from "../../components/AuthGate";
import { apiFetch } from "../../lib/api-client";
import {
  EMPTY_ONBOARDING,
  canSubmit,
  toTasteProfileInput,
  toggleInterest,
  type OnboardingState
} from "../../lib/onboarding";
import { InterestGrid } from "../../components/onboarding/InterestGrid";
import { SegmentedControl } from "../../components/onboarding/SegmentedControl";
import { BudgetPills } from "../../components/onboarding/BudgetPills";

const PACE_LABELS: Record<string, string> = {
  relaxado: "Relaxado",
  moderado: "Moderado",
  intenso: "Intenso"
};
const PARTY_LABELS: Record<string, string> = {
  sozinho: "Sozinho",
  casal: "Casal",
  familia: "Família",
  amigos: "Amigos"
};

const paceOptions = paceEnum.options.map((v) => ({ value: v, label: PACE_LABELS[v] ?? v }));
const partyOptions = partyEnum.options.map((v) => ({ value: v, label: PARTY_LABELS[v] ?? v }));

function OnboardingForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(EMPTY_ONBOARDING);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(next: Partial<OnboardingState>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch({
        path: "/me/profile",
        method: "PUT",
        schema: tasteProfileSchema,
        token,
        body: toTasteProfileInput(state)
      });
      router.push("/trips");
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro ao salvar");
      setSaving(false);
    }
  }

  return (
    <main>
      <h1>Seu perfil de viagem</h1>

      <InterestGrid
        selected={state.interests}
        onToggle={(interest) => patch({ interests: toggleInterest(state.interests, interest) })}
      />

      <SegmentedControl
        label="Ritmo"
        options={paceOptions}
        value={state.pace}
        onChange={(value) => patch({ pace: value as TasteProfileInput["pace"] })}
      />

      <SegmentedControl
        label="Companhia"
        options={partyOptions}
        value={state.partyType}
        onChange={(value) => patch({ partyType: value as TasteProfileInput["partyType"] })}
      />

      <BudgetPills
        value={state.budgetBand}
        onChange={(value) => patch({ budgetBand: value as TasteProfileInput["budgetBand"] })}
      />

      <button type="button" disabled={!canSubmit(state) || saving} onClick={submit}>
        {saving ? "Salvando…" : "Continuar"}
      </button>

      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}

export default function OnboardingPage() {
  return <AuthGate>{(token) => <OnboardingForm token={token} />}</AuthGate>;
}
