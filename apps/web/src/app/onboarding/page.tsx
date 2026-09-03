"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@farol/ui";
import "./onboarding.css";
import { paceEnum, partyEnum, tasteProfileSchema, type TasteProfileInput } from "@farol/shared";
import { BrandHeader } from "../../components/common/BrandHeader";
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
    <main className="screen screen--wide">
      <BrandHeader />

      <div className="screen__card">
        <h1 className="screen__title">O que te move numa viagem?</h1>
        <p className="screen__sub">
          Isso ajusta todas as recomendações de destino e de roteiro. Dá para mudar depois.
        </p>

        <InterestGrid
          selected={state.interests}
          onToggle={(interest) => patch({ interests: toggleInterest(state.interests, interest) })}
        />

        <SegmentedControl
          label="Ritmo da viagem"
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

        <div className="screen__foot">
          <Button
            type="button"
            size="lg"
            disabled={!canSubmit(state) || saving}
            loading={saving}
            iconEnd={
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                   strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            }
            onClick={() => void submit()}
          >
            {saving ? "Salvando…" : "Continuar"}
          </Button>
        </div>

        {error ? (
          <p className="screen__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return <AuthGate>{(token) => <OnboardingForm token={token} />}</AuthGate>;
}
