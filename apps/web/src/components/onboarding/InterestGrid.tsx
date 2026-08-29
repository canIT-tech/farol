"use client";

import { INTEREST_OPTIONS, MIN_INTERESTS } from "../../lib/onboarding";

export function InterestGrid({
  selected,
  onToggle
}: {
  selected: string[];
  onToggle: (interest: string) => void;
}) {
  return (
    <fieldset>
      <legend>Do que você gosta numa viagem? (mínimo {MIN_INTERESTS})</legend>
      <div role="group" aria-label="Interesses">
        {INTEREST_OPTIONS.map((interest) => (
          <button
            key={interest}
            type="button"
            aria-pressed={selected.includes(interest)}
            onClick={() => onToggle(interest)}
          >
            {interest}
          </button>
        ))}
      </div>
      <p aria-live="polite">
        {selected.length} de {MIN_INTERESTS} selecionados
      </p>
    </fieldset>
  );
}
