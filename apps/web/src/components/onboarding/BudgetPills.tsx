"use client";

import { budgetEnum } from "@farol/shared";
import { SegmentedControl } from "./SegmentedControl";

// Record da união completa, não de string: o compilador cobra rótulo para toda
// faixa nova e não sobra fallback inalcançável.
const BUDGET_LABELS: Record<(typeof budgetEnum.options)[number], string> = {
  economico: "Econômico",
  medio: "Médio",
  conforto: "Conforto",
  luxo: "Luxo"
};

export function BudgetPills({
  value,
  onChange
}: {
  value: string | null;
  onChange: (value: string) => void;
}) {
  const options = budgetEnum.options.map((entry) => ({
    value: entry,
    label: BUDGET_LABELS[entry]
  }));
  return (
    <SegmentedControl
      label="Orçamento por pessoa"
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
