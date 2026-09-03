import "./StepNav.css";

export type StepState = "done" | "current" | "todo";
export type Step = { id: string; label: string; state: StepState };

export type StepNavProps = {
  steps: Step[];
  onNavigate?: (id: string) => void;
};

/** Marcador do passo: círculo vazio, e com visto quando concluído. */
function Marker({ done }: { done: boolean }) {
  return (
    <span className="farol-stepnav__marker" aria-hidden="true">
      {done ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
             strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12l5 5L20 6" />
        </svg>
      ) : null}
    </span>
  );
}

export function StepNav({ steps, onNavigate }: StepNavProps) {
  return (
    <ol className="farol-stepnav">
      {steps.map((step) => {
        const clickable = step.state === "done" && Boolean(onNavigate);
        const body = (
          <>
            <Marker done={step.state === "done"} />
            {step.label}
          </>
        );
        return (
          <li
            key={step.id}
            className={`farol-stepnav__item farol-stepnav__item--${step.state}`}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {clickable ? (
              <button
                type="button"
                className="farol-stepnav__link"
                onClick={() => onNavigate?.(step.id)}
              >
                {body}
              </button>
            ) : (
              <span className="farol-stepnav__link">{body}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
