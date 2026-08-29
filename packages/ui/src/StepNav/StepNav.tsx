import "./StepNav.css";

export type StepState = "done" | "current" | "todo";
export type Step = { id: string; label: string; state: StepState };

export type StepNavProps = {
  steps: Step[];
  onNavigate?: (id: string) => void;
};

export function StepNav({ steps, onNavigate }: StepNavProps) {
  return (
    <ol className="farol-stepnav">
      {steps.map((step) => {
        const clickable = step.state === "done" && Boolean(onNavigate);
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
                {step.label}
              </button>
            ) : (
              <span className="farol-stepnav__link">{step.label}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
