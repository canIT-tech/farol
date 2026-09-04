"use client";

import { INTEREST_OPTIONS, MIN_INTERESTS } from "../../lib/onboarding";
import { interestIcon } from "../../lib/interest-icons";

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12l5 5L20 6" />
    </svg>
  );
}

export function InterestGrid({
  selected,
  onToggle
}: {
  selected: string[];
  onToggle: (interest: string) => void;
}) {
  return (
    <fieldset className="screen__row">
      <legend className="screen__label">
        Do que você gosta numa viagem? <span>— escolha ao menos {MIN_INTERESTS}</span>
      </legend>
      <div className="ob-tiles" role="group" aria-label="Interesses">
        {INTEREST_OPTIONS.map((interest) => {
          const on = selected.includes(interest);
          return (
            <button
              key={interest}
              type="button"
              className={on ? "ob-tile ob-tile--on" : "ob-tile"}
              aria-pressed={on}
              onClick={() => onToggle(interest)}
            >
              {on ? (
                <span className="ob-tile__check" aria-hidden="true">
                  <Check />
                </span>
              ) : null}
              <svg className="ob-tile__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={interestIcon(interest)} />
              </svg>
              <span className="ob-tile__label">{interest}</span>
            </button>
          );
        })}
      </div>
      <p className="screen__hint" aria-live="polite">
        {selected.length} de {MIN_INTERESTS} selecionados
      </p>
    </fieldset>
  );
}
